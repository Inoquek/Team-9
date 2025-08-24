import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import { TrendingUp, Users, Target, Trophy, AlertTriangle, Brain } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal } from "lucide-react";

import { collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { useTeacherClass } from "@/contexts/TeacherClassContext";
// try your services first; fall back to demo data if any are missing
import * as AssignmentService from "@/lib/services/assignments";
import * as StudentsService from "@/lib/services/students";
import * as StudyTimeService from "@/lib/services/studyTime";
import * as ClassesService from "@/lib/services/classes";
import AIRecommendationService, { ParentRecommendation } from "@/lib/services/aiRecommendations";
import AIRecommendationWidget from "./AIRecommendationWidget";

type Subject = "Math" | "Science" | "Reading" | "Writing" | "Art";
type SubjectPerf = { subject: Subject; childAvg: number; classAvg: number };
type MonthSeries = { month: string; avgScore: number };
type SubmissionStats = { submitted: number; missed: number };
type WeeklyEngagement = { minutes: number; recommendedMinutes: number };
type StudentLite = { id: string; name: string; classId?: string };

type StudentRow = {
  id: string;
  name: string;
  classId: string;
  avgScore: number;            // overall avg across submissions
  monthlySeries: { month: string; value: number }[]; // for sparkline
  submissionRate: number;      // submitted / total
  attendance?: number;         // optional if you track it; we mirror the mock with same bar UI
};

const RECOMMENDED_WEEKLY_MIN = 180;
const PIE_COLORS = ["#00C49F", "#FF8042"];
const initials = (name: string) =>
  name ? name.split(" ").map(p=>p[0]).slice(0,2).join("").toUpperCase() : "ST";


const ClassPicker: React.FC<{
  teacherClasses: { id: string; name: string; grade: string }[];
  selectedId?: string;
  onChange: (id: string) => void;
}> = ({ teacherClasses, selectedId, onChange }) => {
  if (!teacherClasses.length) return null;
  return (
    <div className="w-64">
      <Select value={selectedId} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select class" />
        </SelectTrigger>
        <SelectContent>
          {teacherClasses.map(c => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} • Grade {c.grade}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const Sparkline: React.FC<{ data: { month: string; value: number }[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height={36}>
    <LineChart data={data}>
      <Tooltip />
      <Line type="monotone" dataKey="value" dot={false} strokeWidth={2} />
    </LineChart>
  </ResponsiveContainer>
);


// --- overview cards aggregator (compute from rows)
const OverviewHeader: React.FC<{ rows: StudentRow[]; classId: string }> = ({ rows, classId }) => {
  const [overviewData, setOverviewData] = useState({
    classAvgScore: 0,
    submissionRate: 0,
    studentCount: 0,
    atRiskCount: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const calculateOverviewData = async () => {
      if (!classId) return;
      
      setLoading(true);
      try {
        console.log('Metrics: Starting overview data calculation for class:', classId);
        
        // Get all assignments for the class
        const aAny = AssignmentService as any;
        const assignments = await aAny.AssignmentService.getClassAssignments(classId);
        console.log('Metrics: Found assignments:', assignments.length);
        
        const totalAssignmentPoints = assignments.reduce((sum, assignment) => sum + (assignment.points || 0), 0);
        console.log('Metrics: Total assignment points:', totalAssignmentPoints);
        
        // Get all students in the class
        const studentsQuery = query(
          collection(db, "students"),
          where("classId", "==", classId),
          where("isActive", "==", true)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        const students = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        const studentCount = students.length;
        console.log('Metrics: Found students:', studentCount);
        
        // Calculate total expected submissions (students × assignments)
        const totalExpectedSubmissions = studentCount * assignments.length;
        console.log('Metrics: Total expected submissions:', totalExpectedSubmissions);
        
        // Get all submissions for the class
        let submissions: any[] = [];
        
        // Get submissions by querying through assignments (since submissions don't have classId)
        const assignmentIds = assignments.map(a => a.id);
        console.log('Metrics: Assignment IDs for class:', assignmentIds);
        
        if (assignmentIds.length > 0) {
          // Firestore 'in' query has a limit of 10, so we need to batch
          const batchSize = 10;
          const submissionBatches = [];
          
          for (let i = 0; i < assignmentIds.length; i += batchSize) {
            const batch = assignmentIds.slice(i, i + batchSize);
            console.log('Metrics: Processing batch', Math.floor(i/batchSize) + 1, 'with', batch.length, 'assignments');
            
            const batchQuery = query(
              collection(db, "submissions"),
              where("assignmentId", "in", batch)
            );
            const batchSnapshot = await getDocs(batchQuery);
            const batchSubmissions = batchSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            
            console.log('Metrics: Batch', Math.floor(i/batchSize) + 1, 'found', batchSubmissions.length, 'submissions');
            submissionBatches.push(...batchSubmissions);
          }
          
          submissions = submissionBatches;
          console.log('Metrics: Total submissions found across all batches:', submissions.length);
          console.log('Metrics: Sample submissions with details:', submissions.slice(0, 3).map(s => ({
            id: s.id,
            studentId: s.studentId,
            assignmentId: s.assignmentId,
            points: s.points,
            feedbackPoints: s.feedback?.points,
            status: s.status
          })));
        }
        
        console.log('Metrics: Found students:', students.length, 'submissions:', submissions.length);
        console.log('Metrics: Sample submission data:', submissions.slice(0, 2));
        console.log('Metrics: Sample assignment data:', assignments.slice(0, 2));
        
        // Calculate submission rate
        const submissionRate = totalExpectedSubmissions > 0 
          ? Math.round((submissions.length / totalExpectedSubmissions) * 100) 
          : 0;
        console.log('Metrics: Submission rate calculated:', submissionRate + '%');
        console.log('Metrics: Total expected submissions:', totalExpectedSubmissions, 'Actual submissions:', submissions.length);
        
        // Calculate class average score across all submissions
        let totalScore = 0;
        let scoredSubmissions = 0;
        
        submissions.forEach(submission => {
          if (submission.points && typeof submission.points === 'number') {
            totalScore += submission.points;
            scoredSubmissions++;
          }
        });
        
        const classAvgScore = scoredSubmissions > 0 ? Math.round(totalScore / scoredSubmissions) : 0;
        console.log('Metrics: Class average score calculated:', classAvgScore, 'from', scoredSubmissions, 'scored submissions');
        
        // Calculate at-risk students (those with total available score < 40% of total assignments score)
        let atRiskCount = 0;
        
        for (const student of studentsSnapshot.docs) {
          const studentId = student.id;
          
          // Get student's submissions for this class by filtering from the main submissions array
          // (since submissions don't have classId, we need to check if the assignment belongs to this class)
          const studentSubmissions = submissions.filter(s => s.studentId === studentId);
          
          // Calculate student's total earned points
          let studentTotalEarned = 0;
          studentSubmissions.forEach(submission => {
            if (submission.points && typeof submission.points === 'number') {
              studentTotalEarned += submission.points;
            }
          });
          
          // Check if student is at risk (< 40% of total possible points)
          const riskThreshold = totalAssignmentPoints * 0.4;
          if (studentTotalEarned < riskThreshold) {
            atRiskCount++;
            console.log('Metrics: Student', student.data().name, 'is at risk. Earned:', studentTotalEarned, 'Threshold:', riskThreshold);
          }
        }
        
        console.log('Metrics: At-risk students count:', atRiskCount);
        
        setOverviewData({
          classAvgScore,
          submissionRate,
          studentCount,
          atRiskCount
        });
        
      } catch (error) {
        console.error('Metrics: Error calculating overview data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (classId) {
      calculateOverviewData();
    }
  }, [classId]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            Class Avg Score
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-3xl font-bold text-blue-600">...</div>
          ) : (
            <div className="text-3xl font-bold text-blue-600">{overviewData.classAvgScore}</div>
          )}
          <p className="text-sm text-muted-foreground mt-1">Across all assignments</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Submission Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-3xl font-bold text-green-600">...</div>
          ) : (
            <div className="text-3xl font-bold text-green-600">{overviewData.submissionRate}%</div>
          )}
          <p className="text-sm text-muted-foreground mt-1">Submissions vs Expected</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            Students
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-3xl font-bold text-purple-600">...</div>
          ) : (
            <div className="text-3xl font-bold text-purple-600">{overviewData.studentCount}</div>
          )}
          <p className="text-sm text-muted-foreground mt-1">Active in class</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            At Risk
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-3xl font-bold text-red-600">...</div>
          ) : (
            <div className="text-3xl font-bold text-red-600">{overviewData.atRiskCount}</div>
          )}
          <p className="text-sm text-muted-foreground mt-1">&lt;40% of total points</p>
        </CardContent>
      </Card>

      {/* Calculation Details - Horizontal Layout */}
      {!loading && (
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="text-lg">Calculation Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-2 text-blue-600">Class Average Score</h4>
                <div className="space-y-1 text-muted-foreground">
                  <p>• Calculated from all scored submissions</p>
                  <p>• Only submissions with assigned points are included</p>
                  <p>• Formula: Total Points ÷ Number of Scored Submissions</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2 text-green-600">Submission Rate</h4>
                <div className="space-y-1 text-muted-foreground">
                  <p>• Total Expected: Students × Assignments</p>
                  <p>• Actual Submissions: Count of all submissions</p>
                  <p>• Formula: (Actual ÷ Expected) × 100</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2 text-purple-600">Student Count</h4>
                <div className="space-y-1 text-muted-foreground">
                  <p>• Active students in the selected class</p>
                  <p>• Filtered by isActive = true</p>
                  <p>• Used for calculating expected submissions</p>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2 text-red-600">At Risk Students</h4>
                <div className="space-y-1 text-muted-foreground">
                  <p>• Students with earned points &lt; 40% of total possible</p>
                  <p>• Total Possible: Sum of all assignment points</p>
                  <p>• Risk Threshold: Total Possible × 0.4</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};


const useStudentForGuardian = (userId?: string) => {
  const [student, setStudent] = useState<StudentLite | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancel = false;
    (async () => {
      try {
        if ((StudentsService as any)?.getByParentId) {
          const s = await (StudentsService as any).getByParentId(userId);
          if (!cancel && s) setStudent({ id: s.id, name: s.name, classId: s.classId });
        } else {
          const q = query(
            collection(db, "students"),
            where("parentId", "==", userId),
            where("isActive", "==", true)
          );
          const snap = await getDocs(q);
          if (!cancel && !snap.empty) {
            const d = snap.docs[0];
            const data = d.data() as any;
            setStudent({ id: d.id, name: data.name, classId: data.classId });
          }
        }
      } catch {/* ignore, demo UI still works */}
    })();
    return () => { cancel = true; };
  }, [userId]);
  return student;
};

// ---- demo fallbacks ----
const demoSubjectPerf: SubjectPerf[] = [
  { subject: "Math", childAvg: 82, classAvg: 77 },
  { subject: "Science", childAvg: 74, classAvg: 79 },
  { subject: "Reading", childAvg: 90, classAvg: 85 },
  { subject: "Writing", childAvg: 70, classAvg: 76 },
  { subject: "Art", childAvg: 88, classAvg: 84 },
];
const demoMonthly: MonthSeries[] = [
  { month: "Jan", avgScore: 74 }, { month: "Feb", avgScore: 76 }, { month: "Mar", avgScore: 79 },
  { month: "Apr", avgScore: 80 }, { month: "May", avgScore: 83 }, { month: "Jun", avgScore: 81 },
  { month: "Jul", avgScore: 85 },
];
const demoSubs: SubmissionStats = { submitted: 18, missed: 5 };

const GuardianSection: React.FC<{ student: StudentLite }> = ({ student }) => {
  const [subjectPerf, setSubjectPerf] = useState<SubjectPerf[]>([]);
  const [monthly, setMonthly] = useState<MonthSeries[]>(demoMonthly);
  const [subs, setSubs] = useState<SubmissionStats>(demoSubs);
  const [weekly, setWeekly] = useState<WeeklyEngagement>({ minutes: 135, recommendedMinutes: RECOMMENDED_WEEKLY_MIN });
  const [loading, setLoading] = useState(true);
  const [gradeProgression, setGradeProgression] = useState<any[]>([]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        console.log('Guardian: Loading subject performance for student:', student.id, 'in class:', student.classId);
        
        // Get all assignments for the student's class
        const aAny = AssignmentService as any;
        const assignments = await aAny.AssignmentService.getClassAssignments(student.classId);
        console.log('Guardian: Found assignments:', assignments.length);
        
        // Get all students in the class for class average calculation
        const studentsQuery = query(
          collection(db, "students"),
          where("classId", "==", student.classId),
          where("isActive", "==", true)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        const students = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        console.log('Guardian: Found students in class:', students.length);
        
        // Get all submissions for the class by querying through assignments
        let submissions: any[] = [];
        const assignmentIds = assignments.map(a => a.id);
        
        if (assignmentIds.length > 0) {
          // Firestore 'in' query has a limit of 10, so we need to batch
          const batchSize = 10;
          const submissionBatches = [];
          
          for (let i = 0; i < assignmentIds.length; i += batchSize) {
            const batch = assignmentIds.slice(i, i + batchSize);
            const batchQuery = query(
              collection(db, "submissions"),
              where("assignmentId", "in", batch)
            );
            const batchSnapshot = await getDocs(batchQuery);
            const batchSubmissions = batchSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            submissionBatches.push(...batchSubmissions);
          }
          
          submissions = submissionBatches;
          console.log('Guardian: Found submissions:', submissions.length);
        }
        
        // Extract unique assignment types (subjects)
        const assignmentTypes = Array.from(new Set(assignments.map(a => a.type))).filter(Boolean);
        console.log('Guardian: Assignment types found:', assignmentTypes);
        
        // Calculate subject performance for each assignment type
        const subjectPerformance: SubjectPerf[] = [];
        
        for (const assignmentType of assignmentTypes) {
          console.log('Guardian: Processing assignment type:', assignmentType);
          
          // Get assignments of this type
          const typeAssignments = assignments.filter(a => a.type === assignmentType);
          
          // Calculate child's average for this subject
          const childSubmissions = submissions.filter(s => 
            s.studentId === student.id && 
            typeAssignments.some(a => a.id === s.assignmentId)
          );
          
          let childTotalScore = 0;
          let childScoredSubmissions = 0;
          
          childSubmissions.forEach(submission => {
            // Use feedback points (teacher's assessment) or fallback to main points
            let submissionPoints = 0;
            if (submission.feedback && submission.feedback.points && typeof submission.feedback.points === 'number') {
              submissionPoints = submission.feedback.points;
            } else if (submission.points && typeof submission.points === 'number' && submission.points > 0) {
              submissionPoints = submission.points;
            }
            
            if (submissionPoints > 0) {
              childTotalScore += submissionPoints;
              childScoredSubmissions++;
            }
          });
          
          const childAvg = childScoredSubmissions > 0 ? Math.round(childTotalScore / childScoredSubmissions) : 0;
          
          // Calculate class average for this subject
          let classTotalScore = 0;
          let classScoredSubmissions = 0;
          
          for (const classStudent of students) {
            const studentSubmissions = submissions.filter(s => 
              s.studentId === classStudent.id && 
              typeAssignments.some(a => a.id === s.assignmentId)
            );
            
            studentSubmissions.forEach(submission => {
              let submissionPoints = 0;
              if (submission.feedback && submission.feedback.points && typeof submission.feedback.points === 'number') {
                submissionPoints = submission.feedback.points;
              } else if (submission.points && typeof submission.points === 'number' && submission.points > 0) {
                submissionPoints = submission.points;
              }
              
              if (submissionPoints > 0) {
                classTotalScore += submissionPoints;
                classScoredSubmissions++;
              }
            });
          }
          
          const classAvg = classScoredSubmissions > 0 ? Math.round(classTotalScore / classScoredSubmissions) : 0;
          
          console.log('Guardian: Subject', assignmentType, '- Child avg:', childAvg, 'Class avg:', classAvg);
          
          subjectPerformance.push({
            subject: assignmentType as Subject,
            childAvg,
            classAvg
          });
        }
        
        if (!cancel) {
          console.log('Guardian: Final subject performance:', subjectPerformance);
          setSubjectPerf(subjectPerformance);
        }
        
        // Load other data (keeping existing logic for now)
        if ((StudyTimeService as any)?.getWeeklyEngagementForStudent) {
          const w = await (StudyTimeService as any).getWeeklyEngagementForStudent(student.id);
          if (!cancel && w) setWeekly({ minutes: w.minutes ?? 0, recommendedMinutes: w.recommendedMinutes ?? RECOMMENDED_WEEKLY_MIN });
        }
        
        // Calculate real study time from assignment completion times
        let totalCompletionTime = 0;
        let completedAssignments = 0;
        
        // Get child's submissions
        const childSubmissions = submissions.filter(s => s.studentId === student.id);
        
        childSubmissions.forEach(submission => {
          if (submission.completionTimeMinutes && typeof submission.completionTimeMinutes === 'number') {
            totalCompletionTime += submission.completionTimeMinutes;
            completedAssignments++;
          }
        });
        
        console.log('Guardian: Study time calculation - Total minutes:', totalCompletionTime, 'Completed assignments:', completedAssignments);
        
        // Calculate submission rate (assignments completed vs. total posted)
        const totalAssignmentsPosted = assignments.length;
        const assignmentsCompleted = childSubmissions.length;
        const submissionRate = totalAssignmentsPosted > 0 ? Math.round((assignmentsCompleted / totalAssignmentsPosted) * 100) : 0;
        
        console.log('Guardian: Submission rate - Completed:', assignmentsCompleted, 'Total posted:', totalAssignmentsPosted, 'Rate:', submissionRate + '%');
        
        // Update submission stats with real data
        if (!cancel) {
          setSubs({
            submitted: assignmentsCompleted,
            missed: totalAssignmentsPosted - assignmentsCompleted
          });
        }
        
        // Update weekly engagement with real data
        if (!cancel) {
          setWeekly({
            minutes: totalCompletionTime,
            recommendedMinutes: RECOMMENDED_WEEKLY_MIN
          });
        }
        
        // Calculate grade progression by assignment type over time
        console.log('Guardian: Calculating grade progression by assignment type');
        
        // Get all assignments with dates and types
        const assignmentsWithDates = assignments
          .filter(a => a.dueDate || a.createdAt)
          .map(a => ({
            id: a.id,
            type: a.type,
            title: a.title,
            date: a.dueDate?.toDate?.() || a.createdAt?.toDate?.() || new Date(),
            points: a.points || 100
          }))
          .sort((a, b) => a.date.getTime() - b.date.getTime());
        
        console.log('Guardian: Assignments with dates:', assignmentsWithDates.length);
        
        // Create chronological progression of all graded assignments
        const chronologicalScores: any[] = [];
        let totalPointsEarned = 0;
        let totalPointsPossible = 0;
        let gradedAssignments = 0;
        
        assignmentsWithDates.forEach(assignment => {
          // Find child's submission for this assignment
          const childSubmission = childSubmissions.find(s => s.assignmentId === assignment.id);
          
          if (childSubmission && childSubmission.feedback && childSubmission.feedback.points && typeof childSubmission.feedback.points === 'number') {
            // Only include assignments that have been submitted AND have feedback
            const score = childSubmission.feedback.points;
            const maxPoints = assignment.points || 100;
            
            // Individual score should be the actual percentage from feedback points
            const scorePercentage = maxPoints > 0 ? Math.round((score / maxPoints) * 100) : 0;
            
            totalPointsEarned += score;
            totalPointsPossible += maxPoints;
            gradedAssignments++;
            
            // Calculate cumulative percentage: (total earned / total possible) * 100
            const cumulativePercentage = totalPointsPossible > 0 ? Math.round((totalPointsEarned / totalPointsPossible) * 100) : 0;
            
            chronologicalScores.push({
              assignmentId: assignment.id,
              title: assignment.title,
              subject: assignment.type,
              date: assignment.date,
              individualScore: scorePercentage,
              cumulativeScore: cumulativePercentage,
              assignmentNumber: gradedAssignments,
              fullDate: assignment.date.toLocaleDateString(),
              totalEarned: totalPointsEarned,
              totalPossible: totalPointsPossible,
              feedbackPoints: score,
              maxPoints: maxPoints
            });
          }
        });
        
        console.log('Guardian: Chronological grade progression:', chronologicalScores);
        
        if (!cancel) {
          setGradeProgression(chronologicalScores);
        }
        
      } catch (error) {
        console.error('Guardian: Error loading subject performance:', error);
        // Fallback to demo data
        setSubjectPerf(demoSubjectPerf);
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => { cancel = true; };
  }, [student.id, student.classId]);

  const pieData = useMemo(
    () => [{ name: "Submitted", value: subs.submitted }, { name: "Missed", value: subs.missed }],
    [subs]
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TrendingUp className="h-5 w-5" />Subject performance</CardTitle></CardHeader>
        <CardContent className="h-72">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-muted-foreground mb-2">Loading subject performance...</div>
                <div className="text-sm text-muted-foreground">Calculating averages for each subject</div>
              </div>
            </div>
          ) : subjectPerf.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectPerf}>
              <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="childAvg" name={student.name} fill="#3b82f6" />
                <Bar dataKey="classAvg" name="Class avg" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <div className="mb-2">No subject data available</div>
                <div className="text-sm">Assignments and submissions will appear here</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Parent engagement</CardTitle></CardHeader>
          <CardContent className="h-64">
            <div className="text-3xl font-bold">{weekly.minutes} min</div>
            <p className="text-sm text-muted-foreground mt-2">Recommended {weekly.recommendedMinutes} min/wk</p>
            <Badge variant={weekly.minutes >= weekly.recommendedMinutes ? ("success" as any) : "secondary"}>
              {weekly.minutes >= weekly.recommendedMinutes ? "On track" : "Add a bit more"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Assignment Completion Rate</CardTitle></CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-sm text-muted-foreground mt-2">
              {subs.submitted} of {subs.submitted + subs.missed} assignments completed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Grade Improvement Graph - Full Width Below */}
        <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Academic Progress Over Time</CardTitle></CardHeader>
        <CardContent className="h-80">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-muted-foreground mb-2">Loading academic progress...</div>
                <div className="text-sm text-muted-foreground">Calculating cumulative scores over time</div>
              </div>
            </div>
          ) : gradeProgression.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={gradeProgression}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="fullDate" 
                  type="category"
                  allowDuplicatedCategory={false}
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis domain={[0, 100]} />
                <Tooltip 
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-semibold">{label}</p>
                          <p className="text-sm text-muted-foreground">{data.title}</p>
                          <p className="text-sm text-muted-foreground">Subject: {data.subject}</p>
                          <p className="text-sm text-muted-foreground">Assignment #{data.assignmentNumber}</p>
                          <p style={{ color: payload[0].color }}>
                            Cumulative Score: {data.cumulativeScore}%
                          </p>
                          <p style={{ color: payload[0].color }}>
                            Individual Score: {data.individualScore}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Feedback: {data.feedbackPoints}/{data.maxPoints} points
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Total: {data.totalEarned}/{data.totalPossible} points
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line
                  type="natural"
                  dataKey="cumulativeScore"
                  name="Cumulative Score %"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ r: 5, fill: "#3b82f6" }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-muted-foreground">
                <div className="mb-2">No academic progress data available</div>
                <div className="text-sm">Completed assignments with feedback will appear here</div>
              </div>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-2">Cumulative academic performance progression over time across all subjects</p>
          </CardContent>
        </Card>

        {/* AI Recommendations Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              AI Learning Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AIRecommendationWidget 
              parentId={useAuth().user?.uid || ''} 
              showChinese={true}
              onViewAll={() => {
                console.log('Navigate to full recommendations page');
              }}
            />
            
            {/* Test Button for Generating Recommendations */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  const { user } = useAuth();
                  const { toast } = useToast();
                  
                  try {
                    if (!user?.uid) {
                      toast({
                        title: "Error",
                        description: "Please make sure you're logged in.",
                        variant: "destructive"
                      });
                      return;
                    }
                    
                    // Create a test student context
                    const testContext = {
                      studentId: student.id,
                      name: student.name || 'Student',
                      classId: student.classId || 'default_class',
                      parentId: user.uid,
                      recentGrades: [85, 92, 78, 88],
                      completionRate: 85,
                      studyTimeMinutes: 120,
                      upcomingDeadlines: [
                        {
                          assignmentTitle: 'Math Homework',
                          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                          subject: 'Mathematics'
                        }
                      ],
                      strugglingSubjects: ['Physics'],
                      parentEngagementLevel: 'medium' as const
                    };
                    
                    const result = await AIRecommendationService.generateRecommendation(testContext);
                    
                    toast({
                      title: "AI Recommendation Generated!",
                      description: "New personalized recommendation created based on your child's progress.",
                    });
                    
                    // Refresh the page to show new recommendations
                    setTimeout(() => {
                      window.location.reload();
                    }, 1000);
                    
                  } catch (error) {
                    console.error('Error generating recommendation:', error);
                    toast({
                      title: "Error",
                      description: "Failed to generate recommendation. Please try again.",
                      variant: "destructive"
                    });
                  }
                }}
                className="w-full"
              >
                🧠 Generate New AI Recommendation
              </Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
};

type ClassRankingRow = { 
  studentId: string; 
  studentName: string; 
  subject: Subject; 
  rank: number; 
  avgScore: number;
  totalScore?: number;
  submissions?: number;
  gradedSubmissions?: number;
};

const TeacherSection: React.FC<{ classId: string }> = ({ classId }) => {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>(["Math","Science","Reading","Writing","Art"]);
  const [selected, setSelected] = useState<StudentLite | null>(null);
  const [tab, setTab] = useState<"overview"|"rankings"|"students">("overview");
  const [qText, setQText] = useState("");

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        // 1) load active students of the class
        const sq = query(collection(db,"students"), where("classId","==",classId), where("isActive","==",true));
        const sSnap = await getDocs(sq);
        const students = sSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as any[];

        // 2) load submissions for the class and aggregate
        const subQ = query(collection(db,"submissions"), where("classId","==",classId));
        const subSnap = await getDocs(subQ);
        const byStudent: Record<string, { sum:number; n:number; byMonth: Record<string,{sum:number;n:number}>; submitted:number; total:number }> = {};
        const monthKey = (dt: Date) => dt.toLocaleString("en-US",{month:"short"});

        subSnap.forEach(doc=>{
          const d = doc.data() as any;
          const sid = d.studentId;
          if (!byStudent[sid]) byStudent[sid] = { sum:0, n:0, byMonth:{}, submitted:0, total:0 };
          const created = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || Date.now());
          const mk = monthKey(created);
          if (!byStudent[sid].byMonth[mk]) byStudent[sid].byMonth[mk] = { sum:0, n:0 };
          if (typeof d.score === "number") {
            byStudent[sid].sum += d.score; byStudent[sid].n += 1;
            byStudent[sid].byMonth[mk].sum += d.score; byStudent[sid].byMonth[mk].n += 1;
          }
          byStudent[sid].total += 1;
          byStudent[sid].submitted += (d.status === "missed" ? 0 : 1);
        });

        // 3) build student rows
        const order = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        const makeSeries = (m: Record<string,{sum:number;n:number}>) =>
          order.map(k => m[k] ? { month:k, value: Math.round(m[k].sum / m[k].n) } : { month:k, value: 0 });

        const rowsBuilt: StudentRow[] = students.map(s => {
          const agg = byStudent[s.id] || { sum:0, n:0, byMonth:{}, submitted:0, total:0 };
          const avg = agg.n ? Math.round(agg.sum / agg.n) : 0;
          const rate = agg.total ? Math.round((agg.submitted/agg.total)*100) : 0;
          return {
            id: s.id,
            name: s.name || "Student",
            classId: s.classId,
            avgScore: avg,
            monthlySeries: makeSeries(agg.byMonth),
            submissionRate: rate,
            attendance: undefined, // plug your attendance calc here if available
          };
        });

        if (!cancel) setRows(rowsBuilt);

        // 4) collect subjects for ranking tabs (if you store subject field in submissions)
        const subjSet = new Set<string>();
        subSnap.forEach(doc => { const d=doc.data() as any; if (d.subject) subjSet.add(d.subject); });
        if (subjSet.size && !cancel) setSubjects(Array.from(subjSet) as Subject[]);
      } catch {
        // fallback demo rows (5 students)
        if (!cancel) {
          const demo: StudentRow[] = ["Ava","Ben","Chloe","Diego","Ethan"].map((n,i)=>({
            id:`s${i}`, name:n, classId:classId, avgScore: 80+(i%5),
            submissionRate: 60 + ((i*7)%35),
            monthlySeries: ["Jan","Feb","Mar","Apr","May","Jun","Jul"].map((m,j)=>({ month:m, value: 70 + ((i*3+j*2)%25) })),
          }));
          setRows(demo);
        }
      }
    })();
    return () => { cancel = true; };
  }, [classId]);

  // ---- Rankings data (reuse existing function if present)
  const [rankRows, setRankRows] = useState<ClassRankingRow[]>([]);
  const [assignmentTypes, setAssignmentTypes] = useState<string[]>([]);
  
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        console.log('Metrics: Loading rankings data for class:', classId);
        
        // Get all assignments for the class to determine assignment types
        const aAny = AssignmentService as any;
        const assignments = await aAny.AssignmentService.getClassAssignments(classId);
        
        // Extract unique assignment types from actual assignments
        const types = Array.from(new Set(assignments.map(a => a.type))).filter(Boolean) as string[];
        console.log('Metrics: Found assignment types:', types);
        console.log('Metrics: Assignment type values (with quotes):', types.map(t => `"${t}"`));
        console.log('Metrics: All assignments with their types:', assignments.map(a => ({ id: a.id, type: a.type, title: a.title })));
        setAssignmentTypes(types);
        
        // Get all students in the class
        const studentsQuery = query(
          collection(db, "students"),
          where("classId", "==", classId),
          where("isActive", "==", true)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        const students = studentsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        
        // Get all submissions for the class by querying through assignments (since submissions don't have classId)
        let submissions: any[] = [];
        const assignmentIds = assignments.map(a => a.id);
        console.log('Metrics: Assignment IDs for class:', assignmentIds);
        
        if (assignmentIds.length > 0) {
          // Firestore 'in' query has a limit of 10, so we need to batch
          const batchSize = 10;
          const submissionBatches = [];
          
          for (let i = 0; i < assignmentIds.length; i += batchSize) {
            const batch = assignmentIds.slice(i, i + batchSize);
            console.log('Metrics: Processing batch', Math.floor(i/batchSize) + 1, 'with', batch.length, 'assignments');
            
            const batchQuery = query(
              collection(db, "submissions"),
              where("assignmentId", "in", batch)
            );
            const batchSnapshot = await getDocs(batchQuery);
            const batchSubmissions = batchSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            
            console.log('Metrics: Batch', Math.floor(i/batchSize) + 1, 'found', batchSubmissions.length, 'submissions');
            submissionBatches.push(...batchSubmissions);
          }
          
          submissions = submissionBatches;
          console.log('Metrics: Total submissions found across all batches:', submissions.length);
          console.log('Metrics: Sample submissions with details:', submissions.slice(0, 3).map(s => ({
            id: s.id,
            studentId: s.studentId,
            assignmentId: s.assignmentId,
            points: s.points,
            feedbackPoints: s.feedback?.points,
            status: s.status
          })));
        }
        
        console.log('Metrics: Found students:', students.length, 'submissions:', submissions.length);
        console.log('Metrics: Sample submission data:', submissions.slice(0, 2));
        
        // Data Flow Summary for Debugging
        console.log('=== METRICS DATA FLOW SUMMARY ===');
        console.log('1. Class ID:', classId);
        console.log('2. Assignments found:', assignments.length);
        console.log('3. Assignment types:', types);
        console.log('4. Students found:', students.length);
        console.log('5. Submissions found:', submissions.length);
        console.log('6. Sample submission structure:', submissions.length > 0 ? {
          id: submissions[0].id,
          studentId: submissions[0].studentId,
          assignmentId: submissions[0].assignmentId,
          points: submissions[0].points,
          feedback: submissions[0].feedback,
          feedbackPoints: submissions[0].feedback?.points,
          status: submissions[0].status
        } : 'No submissions');
        console.log('================================');
        
        // Build rankings for each assignment type
        const rankings: ClassRankingRow[] = [];
        
        console.log('Metrics: Starting rankings calculation for', types.length, 'assignment types');
        
        for (const assignmentType of types) {
          console.log('Metrics: Processing assignment type:', assignmentType);
          
          // Get assignments of this type
          const typeAssignments = assignments.filter(a => a.type === assignmentType);
          const totalPossiblePoints = typeAssignments.reduce((sum, a) => sum + (a.points || 0), 0);
          
          console.log('Metrics: Type assignments:', typeAssignments.length, 'Total possible points:', totalPossiblePoints);
          console.log('Metrics: Assignment IDs for this type:', typeAssignments.map(a => a.id));
          console.log('Metrics: All assignments in this type:', typeAssignments.map(a => ({ id: a.id, type: a.type, title: a.title, points: a.points })));
          
          // Calculate scores for each student in this assignment type
          const studentScores: { studentId: string; studentName: string; totalScore: number; avgScore: number; submissions: number; gradedSubmissions: number }[] = [];
          
          for (const student of students) {
            console.log('Metrics: Processing student:', student.name, 'ID:', student.id);
            
            // Get submissions for this student in this assignment type
            const studentTypeSubmissions = submissions.filter(s => {
              const matchesStudent = s.studentId === student.id;
              const matchesAssignment = typeAssignments.some(a => a.id === s.assignmentId);
              
              console.log('Metrics: Checking submission', s.id, '- Student match:', matchesStudent, 'Assignment match:', matchesAssignment, 'Assignment ID:', s.assignmentId, 'Type assignments:', typeAssignments.map(a => a.id));
              
              if (matchesStudent && matchesAssignment) {
                console.log('Metrics: Found matching submission:', s.id, 'for assignment:', s.assignmentId, 'Points:', s.points, 'Feedback points:', s.feedback?.points);
              }
              
              return matchesStudent && matchesAssignment;
            });
            
            console.log('Metrics: Student', student.name, 'has', studentTypeSubmissions.length, 'submissions for type', assignmentType);
            console.log('Metrics: All submissions for this student:', submissions.filter(s => s.studentId === student.id).map(s => ({ id: s.id, assignmentId: s.assignmentId, points: s.points, feedbackPoints: s.feedback?.points })));
            console.log('Metrics: Assignments of this type:', typeAssignments.map(a => ({ id: a.id, type: a.type, title: a.title })));
            
            // Calculate total score and average score
            let totalScore = 0;
            let scoredSubmissions = 0;
            let gradedSubmissions = 0;
            
            studentTypeSubmissions.forEach(submission => {
              console.log('Metrics: Processing submission:', submission.id, 'Points:', submission.points, 'Status:', submission.status, 'Feedback:', submission.feedback);
              
              // Count all submissions (for submission count)
              gradedSubmissions++;
              
              // Calculate points - prioritize feedback points as they are the actual scored points
              let submissionPoints = 0;
              if (submission.feedback && submission.feedback.points && typeof submission.feedback.points === 'number') {
                // Use feedback points (teacher's assessment) - these are the actual scored points
                submissionPoints = submission.feedback.points;
                console.log('Metrics: Using feedback points:', submissionPoints);
              } else if (submission.points && typeof submission.points === 'number' && submission.points > 0) {
                // Fallback to main points field if no feedback
                submissionPoints = submission.points;
                console.log('Metrics: Using main points field:', submissionPoints);
        } else {
                console.log('Metrics: No points assigned to submission:', submission.id);
              }
              
              // Add to total score if we have points
              if (submissionPoints > 0) {
                totalScore += submissionPoints;
                scoredSubmissions++;
                console.log('Metrics: Added points:', submissionPoints, 'Total now:', totalScore);
              }
            });
            
            // Calculate average score ONLY from graded submissions (those with points)
            const avgScore = scoredSubmissions > 0 ? Math.round(totalScore / scoredSubmissions) : 0;
            
            studentScores.push({
              studentId: student.id,
              studentName: student.name || 'Unknown Student',
              totalScore,
              avgScore,
              submissions: studentTypeSubmissions.length, // Total submissions (including ungraded)
              gradedSubmissions: scoredSubmissions // Only submissions with points assigned
            });
            
            console.log('Metrics: Student', student.name, 'in', assignmentType, '- Total:', totalScore, 'Avg:', avgScore, 'Submissions:', studentTypeSubmissions.length, 'Graded:', scoredSubmissions);
          }
          
          // Sort by total score (descending) and assign ranks
          studentScores.sort((a, b) => b.totalScore - a.totalScore);
          
          // Add to rankings with rank information
          studentScores.forEach((score, index) => {
            rankings.push({
              studentId: score.studentId,
              studentName: score.studentName,
              subject: assignmentType as Subject,
              rank: index + 1,
              avgScore: score.avgScore,
              totalScore: score.totalScore,
              submissions: score.submissions,
              gradedSubmissions: score.gradedSubmissions
            });
          });
        }
        
        if (!cancel) {
          console.log('Metrics: Final rankings data:', rankings.length, 'rows');
          console.log('=== FINAL RANKINGS SUMMARY ===');
          rankings.forEach((ranking, index) => {
            console.log(`${index + 1}. ${ranking.studentName} (${ranking.subject}): Rank #${ranking.rank}, Score: ${ranking.totalScore}, Avg: ${ranking.avgScore}, Submissions: ${ranking.submissions}, Graded: ${ranking.gradedSubmissions}`);
          });
          console.log('==============================');
          setRankRows(rankings);
          // Update subjects to use actual assignment types
          setSubjects(types as Subject[]);
        }
        
      } catch (error) {
        console.error('Metrics: Error loading rankings data:', error);
        // Fallback to basic rankings from rows
        if (!cancel && rows.length > 0) {
          const basic = rows.map((r, i) => ({ 
            studentId: r.id, 
            studentName: r.name, 
            subject: "Overall" as Subject, 
            rank: 0, 
            avgScore: r.avgScore 
          }));
          basic.sort((a, b) => b.avgScore - a.avgScore).forEach((r, i) => r.rank = i + 1);
          setRankRows(basic);
        }
      }
    })();
    return () => { cancel = true; };
  }, [classId, rows]);

  const filtered = rows.filter(r => r.name.toLowerCase().includes(qText.toLowerCase()));

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v)=>setTab(v as any)}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <OverviewHeader rows={rows} classId={classId} />
        </TabsContent>

        {/* RANKINGS (your previous table kept) */}
        <TabsContent value="rankings">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Assignment Type Rankings
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Student performance rankings by assignment type. Students with no submissions show 0 scores.
              </p>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue={assignmentTypes[0] ?? "Overall"}>
                <TabsList className="flex flex-wrap">
                  {assignmentTypes.map(s => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}
                </TabsList>
                {assignmentTypes.map(s => {
                  const byS = rankRows.filter(r => r.subject === s).sort((a,b)=>a.rank-b.rank);
                  const show = byS.length ? byS : rankRows; // fallback
                  
                  console.log('Metrics: Rankings for', s, ':', byS.length, 'students');
                  
                  // Calculate summary for this assignment type
                  const totalStudents = byS.length;
                  const totalSubmissions = byS.reduce((sum, r) => sum + (r.submissions || 0), 0);
                  const avgScore = byS.length > 0 ? Math.round(byS.reduce((sum, r) => sum + r.avgScore, 0) / byS.length) : 0;
                  
                  return (
                    <TabsContent key={s} value={s}>
                      {/* Assignment Type Summary */}
                      <div className="mb-6 p-4 bg-muted/30 rounded-lg">
                        <div className="grid grid-cols-4 gap-4 text-center">
                          <div>
                            <div className="text-2xl font-bold text-blue-600">{totalStudents}</div>
                            <div className="text-sm text-muted-foreground">Students</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-green-600">{totalSubmissions}</div>
                            <div className="text-sm text-muted-foreground">Total Submissions</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-orange-600">
                              {byS.reduce((sum, r) => sum + (r.gradedSubmissions || 0), 0)}
                            </div>
                            <div className="text-sm text-muted-foreground">Graded</div>
                          </div>
                          <div>
                            <div className="text-2xl font-bold text-purple-600">{avgScore}</div>
                            <div className="text-sm text-muted-foreground">Class Average</div>
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-muted-foreground text-center">
                          <p><strong>Total Submissions:</strong> All assignments submitted by students</p>
                          <p><strong>Graded:</strong> Submissions that have been assigned points by teachers</p>
                          <p><strong>Average Score:</strong> Calculated only from graded submissions</p>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left border-b">
                            <th className="py-2 pr-4">Rank</th>
                            <th className="py-2 pr-4">Student</th>
                            <th className="py-2 pr-4">Total Score</th>
                            <th className="py-2 pr-4">Avg Score</th>
                            <th className="py-2 pr-4">Total Submissions</th>
                            <th className="py-2 pr-4">Graded</th>
                            <th className="py-2 pr-4">Action</th>
                          </tr></thead>
                          <tbody>
                            {show.map(r=>{
                              // Find the student's data for this subject to get additional info
                              const studentData = rankRows.find(row => 
                                row.studentId === r.studentId && row.subject === r.subject
                              );
                              
                              return (
                              <tr key={`${r.studentId}-${r.subject}`} className="border-b">
                                  <td className="py-2 pr-4">
                                    <Badge variant={r.rank === 1 ? "default" : "secondary"}>
                                      #{r.rank}
                                    </Badge>
                                  </td>
                                  <td className="py-2 pr-4 font-medium">{r.studentName}</td>
                                  <td className="py-2 pr-4">
                                    <span className="font-semibold text-blue-600">
                                      {studentData ? (studentData as any).totalScore || 0 : 0}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-4">
                                    <Badge variant={r.avgScore >= 85 ? "default" : r.avgScore >= 60 ? "secondary" : "destructive"}>
                                      {Math.round(r.avgScore)}
                                    </Badge>
                                  </td>
                                  <td className="py-2 pr-4 text-center">
                                    <span className="text-sm text-muted-foreground">
                                      {studentData ? (studentData as any).submissions || 0 : 0}
                                    </span>
                                  </td>
                                  <td className="py-2 pr-4 text-center">
                                    <span className="text-sm text-green-600 font-medium">
                                      {studentData ? (studentData as any).gradedSubmissions || 0 : 0}
                                    </span>
                                  </td>
                                <td className="py-2 pr-4">
                                  <Button size="sm" onClick={()=>setSelected({ id:r.studentId, name:r.studentName, classId })}>View details</Button>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Student drill‑down (reuse Guardian charts) */}
      <Dialog open={!!selected} onOpenChange={()=>setSelected(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{selected?.name} - Student Metrics</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              {/* Student Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
                  <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><Target className="h-4 w-4" />Overall Performance</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-2xl font-bold">
                      {(() => {
                        const studentData = rankRows.filter(row => row.studentId === selected.id);
                        const totalScore = studentData.reduce((sum, row) => sum + (row.totalScore || 0), 0);
                        const totalGraded = studentData.reduce((sum, row) => sum + (row.gradedSubmissions || 0), 0);
                        
                        // Only calculate percentage if there are graded submissions
                        if (totalGraded === 0) return 0;
                        
                        // Calculate average score from graded submissions only
                        const averageScore = Math.round(totalScore / totalGraded);
                        return averageScore;
                      })()}%
                </div>
                    <p className="text-xs text-muted-foreground mt-1">Average score from graded submissions only</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Assignment Completion</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-2xl font-bold">
                      {(() => {
                        const studentData = rankRows.filter(row => row.studentId === selected.id);
                        const totalSubmissions = studentData.reduce((sum, row) => sum + (row.submissions || 0), 0);
                        const totalGraded = studentData.reduce((sum, row) => sum + (row.gradedSubmissions || 0), 0);
                        return totalSubmissions > 0 ? Math.round((totalGraded / totalSubmissions) * 100) : 0;
                      })()}%
              </div>
                    <p className="text-xs text-muted-foreground mt-1">Graded submissions rate</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-sm">Total Submissions</CardTitle></CardHeader>
                  <CardContent className="pt-0">
                    <div className="text-2xl font-bold">
                      {(() => {
                        const studentData = rankRows.filter(row => row.studentId === selected.id);
                        return studentData.reduce((sum, row) => sum + (row.submissions || 0), 0);
                      })()}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">All assignments submitted</p>
                  </CardContent>
                </Card>
              </div>

              {/* Subject Performance Chart */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-sm"><TrendingUp className="h-4 w-4" />Subject Performance</CardTitle></CardHeader>
                <CardContent className="h-56 pt-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={rankRows.filter(row => row.studentId === selected.id)}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="subject" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="totalScore" name="Total Score" fill="#3b82f6" />
                      <Bar dataKey="avgScore" name="Average Score" fill="#10b981" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Detailed Rankings Table */}
              <Card>
                <CardHeader className="pb-3"><CardTitle className="text-sm">Detailed Subject Rankings</CardTitle></CardHeader>
                <CardContent className="pt-0">
              <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="text-left border-b">
                        <th className="py-2 pr-3">Subject</th>
                        <th className="py-2 pr-3">Rank</th>
                        <th className="py-2 pr-3">Total Score</th>
                        <th className="py-2 pr-3">Avg Score</th>
                        <th className="py-2 pr-3">Submissions</th>
                        <th className="py-2 pr-3">Graded</th>
                      </tr></thead>
                  <tbody>
                        {rankRows.filter(row => row.studentId === selected.id).map((row, index) => (
                          <tr key={row.subject} className="border-b">
                            <td className="py-2 pr-3 font-medium">{row.subject}</td>
                            <td className="py-2 pr-3">
                              <Badge variant={row.rank === 1 ? "default" : "secondary"} className="text-xs">
                                #{row.rank}
                          </Badge>
                        </td>
                            <td className="py-2 pr-3">
                              <span className="font-semibold text-blue-600">
                                {row.totalScore || 0}
                              </span>
                        </td>
                            <td className="py-2 pr-3">
                              <Badge variant={row.avgScore >= 85 ? "default" : row.avgScore >= 60 ? "secondary" : "destructive"} className="text-xs">
                                {Math.round(row.avgScore)}
                              </Badge>
                        </td>
                            <td className="py-2 pr-3 text-center">
                              <span className="text-xs text-muted-foreground">
                                {row.submissions || 0}
                              </span>
                            </td>
                            <td className="py-2 pr-3 text-center">
                              <span className="text-xs text-green-600 font-medium">
                                {row.gradedSubmissions || 0}
                              </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const Metrics: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const student = useStudentForGuardian(user?.uid);
  const [classId, setClassId] = useState<string | undefined>(undefined);

//   useEffect(() => {
//     try { if (student?.classId) setClassId(student.classId); } catch {
//       toast({ title: "Error", description: "Could not load class.", variant: "destructive" });
//     }
//   }, [student, toast]);

  const role = (user as any)?.role ?? "parent";

  const { selectedClass, setSelectedClass, teacherClasses, setTeacherClasses } = useTeacherClass();
  const [adminClasses, setAdminClasses] = useState<any[]>([]);
  const [selectedAdminClass, setSelectedAdminClass] = useState<any>(null);

  useEffect(() => {
    const loadTeacherClasses = async () => {
      if (!user?.uid) return;
      if (role !== "teacher" && role !== "admin") return;
      if (teacherClasses.length) return; // already loaded

      try {
        const classesQuery = query(
          collection(db, "classes"),
          where("teacherId", "==", user.uid),
          where("isActive", "==", true)
        );
        const classesSnapshot = await getDocs(classesQuery);

        // compute studentCount like TeacherDashboard (can be simplified if not needed here)
        const classesData = await Promise.all(
          classesSnapshot.docs.map(async (doc) => {
            const cdata = doc.data() as any;
            const classId = doc.id;

            // Best-effort count to match dashboard behaviour
            let studentCount = 0;
            try {
              const studentsQuery = query(
                collection(db, "students"),
                where("classId", "==", classId),
                where("isActive", "==", true)
              );
              const studentsSnapshot = await getDocs(studentsQuery);
              studentCount = studentsSnapshot.size;
            } catch {
              studentCount = cdata.students?.length || 0;
            }

            return {
              id: classId,
              name: cdata.name,
              grade: cdata.grade,
              studentCount,
              isActive: cdata.isActive,
            };
          })
        );

        setTeacherClasses(classesData);
        if (classesData.length && !selectedClass) setSelectedClass(classesData[0]);
      } catch (e) {
        console.error("Error loading teacher classes for Metrics:", e);
      }
    };

    const loadAdminClasses = async () => {
      if (!user?.uid) return;
      if (role !== "admin") return;
      if (adminClasses.length) return; // already loaded

      try {
        // Load all active classes for admin
        const classesQuery = query(
          collection(db, "classes"),
          where("isActive", "==", true)
        );
        const classesSnapshot = await getDocs(classesQuery);

        const classesData = await Promise.all(
          classesSnapshot.docs.map(async (doc) => {
            const cdata = doc.data() as any;
            const classId = doc.id;

            // Get student count for each class
            let studentCount = 0;
            try {
              const studentsQuery = query(
                collection(db, "students"),
                where("classId", "==", classId),
                where("isActive", "==", true)
              );
              const studentsSnapshot = await getDocs(studentsQuery);
              studentCount = studentsSnapshot.size;
            } catch {
              studentCount = cdata.students?.length || 0;
            }

            return {
              id: classId,
              name: cdata.name,
              grade: cdata.grade,
              studentCount,
              isActive: cdata.isActive,
              teacherId: cdata.teacherId,
            };
          })
        );

        setAdminClasses(classesData);
        if (classesData.length && !selectedAdminClass) setSelectedAdminClass(classesData[0]);
      } catch (e) {
        console.error("Error loading admin classes for Metrics:", e);
      }
    };

    if (role === "admin") {
      loadAdminClasses();
    } else if (role === "teacher") {
    loadTeacherClasses();
    }
  }, [user?.uid, role, teacherClasses.length, adminClasses.length, selectedClass, selectedAdminClass, setSelectedClass, setTeacherClasses]);

  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metrics</h1>
          <p className="text-muted-foreground">
            {role === "teacher" 
              ? selectedClass ? `Class insights for ${selectedClass.name}` : "Select a class to view insights"
              : role === "admin"
              ? selectedAdminClass ? `Class insights for ${selectedAdminClass.name}` : "Select a class to view insights"
              : (student ? `Insights for ${student.name}` : "Loading…")}
          </p>
        </div>

        {/* Show picker for teacher/admin */}
        {role === "teacher" && (
          <ClassPicker
            teacherClasses={teacherClasses}
            selectedId={selectedClass?.id}
            onChange={(id) => {
              const cls = teacherClasses.find(c => c.id === id) || null;
              setSelectedClass(cls);
            }}
          />
        )}
        
        {role === "admin" && (
          <ClassPicker
            teacherClasses={adminClasses}
            selectedId={selectedAdminClass?.id}
            onChange={(id) => {
              const cls = adminClasses.find(c => c.id === id) || null;
              setSelectedAdminClass(cls);
            }}
          />
        )}
      </div>

      {/* Teacher vs Admin vs Guardian sections */}
      {role === "teacher" 
        ? (selectedClass
            ? <TeacherSection classId={selectedClass.id} />
            : <Card><CardContent className="py-8">Select a class to view rankings.</CardContent></Card>)
        : role === "admin"
        ? (selectedAdminClass
            ? <TeacherSection classId={selectedAdminClass.id} />
            : <Card><CardContent className="py-8">Select a class to view rankings.</CardContent></Card>)
        : (student
            ? <GuardianSection student={student} />
            : <Card><CardContent className="py-8">No student found for this account.</CardContent></Card>)
      }
    </div>
  );
};
