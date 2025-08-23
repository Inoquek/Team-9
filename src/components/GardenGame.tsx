import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Sprout, Apple, Award, Users } from "lucide-react";

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

/** ---------- helpers ---------- */

type ProgressRow = {
  studentId: string;
  total: number;
  completed: number;
};

function stageFromPct(p: number) {
  if (p >= 90) return { label: "Blooming", badge: "bg-emerald-100 text-emerald-700" };
  if (p >= 60) return { label: "Sprout",   badge: "bg-lime-100 text-lime-700" };
  if (p > 0)   return { label: "Seedling", badge: "bg-amber-100 text-amber-700" };
  return { label: "Seed", badge: "bg-slate-100 text-slate-700" };
}

/**
 * Compute a student's completion ratio by looking at assignments in their class.
 * Uses the submissions collection to check completion status.
 */

async function getStudentAssignmentProgress(
    studentId: string,
    classId?: string
  ): Promise<{ total: number; completed: number }> {
    if (!classId) return { total: 0, completed: 0 };
  
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
    
      for (const assignment of asSnap.docs) {
        total += 1;
        
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
          // (needsRevision means they need to fix something but it was submitted)
          if (submissionData.status === 'approved' || 
              submissionData.status === 'submitted' || 
              submissionData.status === 'pending') {
            completed += 1;
          }
        }
      }
    
      return { total, completed };
    } catch (error) {
      console.error('Error getting student assignment progress:', error);
      return { total: 0, completed: 0 };
    }
  }
  
/** ---------- component ---------- */

export const GardenGame = () => {
  const { user } = useAuth() as { user: User };
  const { selectedClass } = useTeacherClass();
  const [students, setStudents] = useState<Student[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressRow>>({});
  const [loading, setLoading] = useState(true);

  // Only teachers can access the garden
  if (user?.role !== "teacher") {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Class Garden</h1>
            <p className="text-muted-foreground mt-1">
              This feature is only available to teachers.
            </p>
          </div>
        </div>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              <Sprout className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">Teacher Access Only</p>
              <p className="text-sm">The Class Garden feature is designed for teachers to monitor student progress.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use selectedClass from TeacherClassContext for teachers
  const activeClassId = selectedClass?.id;

  // Load students for teacher's class
  useEffect(() => {
    let cancelled = false;
  
    async function load() {
      if (!user || user.role !== "teacher") return;
      setLoading(true);
      try {
        if (!activeClassId) {
          if (!cancelled) setStudents([]);
          return; // wait for class lookup to finish
        }
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
  }, [user?.uid, user?.role, activeClassId]);

  // load assignment progress for each student
  useEffect(() => {
    let cancelled = false;

    async function loadAllProgress() {
      if (students.length === 0) return;
      const map: Record<string, ProgressRow> = {};

      // Compute per student
      for (const s of students) {
        const { total, completed } = await getStudentAssignmentProgress(s.id, (s as any).classId);
        map[s.id] = { studentId: s.id, total, completed };
      }

      if (!cancelled) setProgress(map);
    }

    loadAllProgress();
    return () => { cancelled = true; };
  }, [students]);

  const classSize = students.length;
  const avgPct = useMemo(() => {
    if (classSize === 0) return 0;
    let sum = 0;
    students.forEach((s) => {
      const p = progress[s.id];
      const pct = p && p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
      sum += pct;
    });
    return Math.round(sum / Math.max(1, classSize));
  }, [students, progress, classSize]);

  // Show message for teachers if no class is selected
  if (user?.role === "teacher" && !activeClassId) {
    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">Class Garden</h1>
            <p className="text-muted-foreground mt-1">
              Each plant represents a student. Growth reflects assignment completion.
            </p>
          </div>
        </div>
        
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              <Sprout className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No Class Selected</p>
              <p className="text-sm">Please select a class from your dashboard to view the garden.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header / Stats */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Class Garden</h1>
          <p className="text-muted-foreground mt-1">
            Each plant represents a student. Growth reflects assignment completion.
            {user?.role === "teacher" && activeClassId && (
              <span className="block mt-1 text-sm font-medium">
                Viewing: {selectedClass?.name}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-7 w-7 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold">{classSize}</p>
                <p className="text-sm text-muted-foreground">Students in garden</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-lime-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Sprout className="h-7 w-7 text-lime-600" />
              <div>
                <p className="text-2xl font-bold">{avgPct}%</p>
                <p className="text-sm text-muted-foreground">Average growth</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Award className="h-7 w-7 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">
                  {
                    students.filter((s) => {
                      const p = progress[s.id];
                      const pct = p && p.total > 0 ? (p.completed / p.total) * 100 : 0;
                      return pct >= 90;
                    }).length
                  }
                </p>
                <p className="text-sm text-muted-foreground">Blooming (≥90%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Garden grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              Loading garden…
            </CardContent>
          </Card>
        )}

        {!loading && students.length === 0 && (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No students found for this account.
            </CardContent>
          </Card>
        )}

        {students.map((s) => {
          const p = progress[s.id];
          const pct = p && p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
          const stage = stageFromPct(pct);

          return (
            <Card key={s.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sprout className="h-5 w-5" />
                <span className="truncate">{s.name ?? "Student"}</span>
                <Badge className={stage.badge}>{stage.label}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
                {s.classId ? `Class: ${s.classId}` : "No class set"}
            </div>

                {/* progress bar */}
                {/* If you don't have a Progress component, replace with a simple div bar */}
                <div className="flex items-center justify-between text-sm">
                  <span>Growth</span>
                  <span className="text-muted-foreground">{pct}%</span>
                </div>
                <Progress value={pct} />

                <div className="text-xs text-muted-foreground">
                  {p ? `${p.completed}/${p.total} assignments` : "No assignments yet"}
                </div>

                {/* a tiny "reward" if fully ripe */}
                {pct >= 100 && (
                  <div className="flex items-center gap-2 text-emerald-700 text-sm">
                    <Apple className="h-4 w-4" />
                    Ripe! Great job 🎉
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

