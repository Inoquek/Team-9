import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trophy, Target, TrendingUp, Users, CheckCircle, Clock, MessageSquare, BookOpen } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useTeacherClass } from "@/contexts/TeacherClassContext";
import { StudentService } from "@/lib/services/students";
import type { Student, User } from "@/lib/types";

import {
  collection,
  doc,
  getDocs,
  getDoc,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/** ---------- types ---------- */

interface GameStats {
  totalParticipants: number;
  currentUserScore: number;
  currentUserRank: number;
  topScore: number;
  medianScore: number;
  averageScore: number;
  currentUserPercentile: number;
}

/** ---------- helpers ---------- */

/**
 * Compute a student's completion ratio by looking at assignments in their class.
 * Uses the submissions collection to check completion status.
 */
async function getStudentAssignmentProgress(
  studentId: string,
  classId?: string
): Promise<{ total: number; completed: number; totalPoints: number; earnedPoints: number }> {
  if (!classId) return { total: 0, completed: 0, totalPoints: 0, earnedPoints: 0 };

  try {
    // Pull this class's active assignments
    const qAssign = query(
      collection(db, "assignments"),
      where("classId", "==", classId),
      where("status", "==", "active")
    );
    const asSnap = await getDocs(qAssign);

    let total = 0;
    let completed = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    for (const assignment of asSnap.docs) {
      total += 1;
      totalPoints += assignment.data().points || 0;

      // Check if student has submitted this assignment
      const submissionQuery = query(
        collection(db, "submissions"),
        where("assignmentId", "==", assignment.id),
        where("studentId", "==", studentId)
      );

      const submissionSnap = await getDocs(submissionQuery);

      if (!submissionSnap.empty) {
        // Student has submitted - check if it's completed
        const submission = submissionSnap.docs[0];
        const submissionData = submission.data();

        // Consider approved, submitted, and pending as completed
        if (submissionData.status === 'approved' || 
            submissionData.status === 'submitted' || 
            submissionData.status === 'pending') {
          completed += 1;
          earnedPoints += assignment.data().points || 0;
        }
      }
    }

    return { total, completed, totalPoints, earnedPoints };
  } catch (error) {
    console.error('Error getting student assignment progress:', error);
    return { total: 0, completed: 0, totalPoints: 0, earnedPoints: 0 };
  }
}

/**
 * Calculate ranking statistics from student data
 */
function calculateRankingStats(
  students: Student[],
  progress: Record<string, { total: number; completed: number; totalPoints: number; earnedPoints: number }>,
  currentUserId: string
): GameStats {
  if (students.length === 0) {
    return {
      totalParticipants: 0,
      currentUserScore: 0,
      currentUserRank: 0,
      topScore: 0,
      medianScore: 0,
      averageScore: 0,
      currentUserPercentile: 0,
    };
  }

  // Calculate scores for all students based on points
  const scores = students.map(student => {
    const p = progress[student.id];
    const score = p && p.totalPoints > 0 ? Math.round((p.earnedPoints / p.totalPoints) * 100) : 0;
    return {
      studentId: student.id,
      score,
      isCurrentUser: student.id === currentUserId,
    };
  });

  // Sort by score (descending)
  scores.sort((a, b) => b.score - a.score);

  // Calculate ranks
  const rankedScores = scores.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));

  // Find current user's data
  const currentUser = rankedScores.find(s => s.isCurrentUser);
  const currentUserScore = currentUser?.score || 0;
  const currentUserRank = currentUser?.rank || 0;

  // Calculate statistics
  const allScores = scores.map(s => s.score);
  const topScore = Math.max(...allScores);
  const averageScore = Math.round(allScores.reduce((sum, score) => sum + score, 0) / allScores.length);
  
  // Calculate median
  const sortedScores = [...allScores].sort((a, b) => a - b);
  const medianScore = sortedScores.length % 2 === 0
    ? Math.round((sortedScores[sortedScores.length / 2 - 1] + sortedScores[sortedScores.length / 2]) / 2)
    : sortedScores[Math.floor(sortedScores.length / 2)];

  // Calculate percentile
  const currentUserPercentile = currentUserRank > 0 
    ? Math.round(((students.length - currentUserRank + 1) / students.length) * 100)
    : 0;

  return {
    totalParticipants: students.length,
    currentUserScore,
    currentUserRank,
    topScore,
    medianScore,
    averageScore,
    currentUserPercentile,
  };
}



/** ---------- component ---------- */

const GardenGame = () => {
  const { user } = useAuth() as { user: User };
  const { selectedClass } = useTeacherClass();
  const [students, setStudents] = useState<Student[]>([]);
  const [progress, setProgress] = useState<Record<string, { total: number; completed: number; totalPoints: number; earnedPoints: number }>>({});
  const [loading, setLoading] = useState(true);

  // Determine class ID based on user role
  const activeClassId = useMemo(() => {
    if (user?.role === "teacher") {
      return selectedClass?.id;
    } else if (user?.role === "parent") {
      // For parents, we'll need to get their children's class
      // This is a placeholder - you might need to implement this logic
      // For now, return null to show the "no class available" message
      return null;
    }
    return null;
  }, [user?.role, selectedClass?.id]);

  // Load students for the class
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user || !activeClassId) {
        if (!cancelled) {
          setStudents([]);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      try {
        const rows = await StudentService.getStudentsByClass(activeClassId);
        if (!cancelled) setStudents(rows);
      } catch (error) {
        console.error('Error loading students:', error);
        if (!cancelled) setStudents([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user?.uid, activeClassId]);

  // Load assignment progress for each student
  useEffect(() => {
    let cancelled = false;

    async function loadAllProgress() {
      if (students.length === 0) return;
      const map: Record<string, { total: number; completed: number; totalPoints: number; earnedPoints: number }> = {};

      // Compute per student
      for (const s of students) {
        const { total, completed, totalPoints, earnedPoints } = await getStudentAssignmentProgress(s.id, (s as any).classId);
        map[s.id] = { total, completed, totalPoints, earnedPoints };
      }

      if (!cancelled) setProgress(map);
    }

    loadAllProgress();
    return () => { cancelled = true; };
  }, [students]);

  // Calculate ranking statistics
  const gameStats = useMemo(() => {
    return calculateRankingStats(students, progress, user?.uid || '');
  }, [students, progress, user?.uid]);

  // Show message if no class is available
  if (!activeClassId) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Garden Game</h1>
            <p className="text-muted-foreground mt-1">
              Track your progress and see how you rank among your classmates.
            </p>
          </div>
        </div>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No Class Available</p>
              <p className="text-sm">
                {user?.role === "teacher" 
                  ? "Please select a class from your dashboard to view the game."
                  : "You need to be assigned to a class to participate in the game."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Garden Game</h1>
          <p className="text-muted-foreground mt-1">
            {user?.role === "teacher" 
              ? "Monitor student progress and see how they rank in your class."
              : "View how your children are performing relative to their classmates."
            }
            {user?.role === "teacher" && (
              <span className="block mt-1 text-sm font-medium">
                Viewing: {selectedClass?.name}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Teacher Student Progress Dashboard */}
      {!loading && user?.role === "teacher" && students.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Users className="h-6 w-6" />
              Student Progress Overview
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Monitor all students' progress and identify who needs attention
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {students.map((student) => {
              const studentProgress = progress[student.id];
              const completionRate = studentProgress && studentProgress.totalPoints > 0 
                ? Math.round((studentProgress.earnedPoints / studentProgress.totalPoints) * 100) 
                : 0;
              const missingAssignments = studentProgress ? studentProgress.total - studentProgress.completed : 0;
              const isBehind = completionRate < 70;
              const isOnTrack = completionRate >= 70 && completionRate < 90;
              const isExcelling = completionRate >= 90;
              
              return (
                <div key={student.id} className={`p-4 rounded-lg border-2 ${
                  isBehind ? 'border-red-200 bg-red-50' :
                  isOnTrack ? 'border-yellow-200 bg-yellow-50' :
                  'border-green-200 bg-green-50'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${
                        isBehind ? 'bg-red-500' :
                        isOnTrack ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`} />
                      <h3 className="font-semibold text-gray-800">{student.name}</h3>
                      <Badge className={`${
                        isBehind ? 'bg-red-100 text-red-700' :
                        isOnTrack ? 'bg-yellow-100 text-yellow-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {isBehind ? 'Needs Attention' : isOnTrack ? 'On Track' : 'Excelling'}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-800">{completionRate}%</div>
                      <div className="text-sm text-muted-foreground">
                        {studentProgress?.completed || 0}/{studentProgress?.total || 0} assignments
                      </div>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between text-sm text-muted-foreground mb-1">
                      <span>Progress</span>
                      <span>{studentProgress?.earnedPoints || 0}/{studentProgress?.totalPoints || 0} points</span>
                    </div>
                    <Progress 
                      value={completionRate} 
                      className={`h-3 ${
                        isBehind ? 'bg-red-100' :
                        isOnTrack ? 'bg-yellow-100' :
                        'bg-green-100'
                      }`}
                    />
                  </div>
                  
                  {/* Missing Assignments & Actions */}
                  {missingAssignments > 0 && (
                    <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-600" />
                        <span className="text-sm font-medium text-gray-700">
                          {missingAssignments} missing assignment{missingAssignments !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.location.href = '/assignments'}
                          className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                        >
                          <BookOpen className="h-4 w-4 mr-1" />
                          View Assignments
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Navigate to assignments page with student filter
                            window.location.href = `/assignments?student=${student.id}`;
                          }}
                          className="bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          Add Comment
                        </Button>
                      </div>
                    </div>
                  )}
                  
                  {/* Motivational Message */}
                  {missingAssignments === 0 && (
                    <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">All assignments completed! Great work!</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}












      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">Loading Game Data</p>
              <p className="text-sm">Calculating rankings and statistics...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {!loading && gameStats.totalParticipants === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No Game Data Available</p>
              <p className="text-sm">
                {user?.role === "teacher" 
                  ? "No students found in this class, or no assignments have been created yet."
                  : "No assignments have been created for your class yet, or no submissions have been made."
                }
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default GardenGame;

