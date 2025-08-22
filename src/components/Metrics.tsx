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
import { TrendingUp, Users, Target, Trophy } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MoreHorizontal } from "lucide-react";

import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

import { useTeacherClass } from "@/contexts/TeacherClassContext";
// try your services first; fall back to demo data if any are missing
import * as AssignmentService from "@/lib/services/assignments";
import * as StudentsService from "@/lib/services/students";
import * as StudyTimeService from "@/lib/services/studyTime";
import * as ClassesService from "@/lib/services/classes";

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
const OverviewHeader: React.FC<{ rows: StudentRow[] }> = ({ rows }) => {
  const classAvg = rows.length ? Math.round(rows.reduce((s,r)=>s+r.avgScore,0)/rows.length) : 0;
  const submissionRate = rows.length
    ? Math.round(rows.reduce((s,r)=>s+r.submissionRate,0)/rows.length)
    : 0;
  const atRisk = rows.filter(r => r.avgScore < 60 || r.submissionRate < 60).length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card><CardHeader><CardTitle>Class avg</CardTitle></CardHeader>
        <CardContent><div className="text-3xl font-bold">{classAvg}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Submission rate</CardTitle></CardHeader>
        <CardContent><div className="text-3xl font-bold">{submissionRate}%</div></CardContent></Card>
      <Card><CardHeader><CardTitle>Students</CardTitle></CardHeader>
        <CardContent><div className="text-3xl font-bold">{rows.length}</div></CardContent></Card>
      <Card><CardHeader><CardTitle>At risk</CardTitle></CardHeader>
        <CardContent><div className="text-3xl font-bold">{atRisk}</div></CardContent></Card>
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
  const [subjectPerf, setSubjectPerf] = useState<SubjectPerf[]>(demoSubjectPerf);
  const [monthly, setMonthly] = useState<MonthSeries[]>(demoMonthly);
  const [subs, setSubs] = useState<SubmissionStats>(demoSubs);
  const [weekly, setWeekly] = useState<WeeklyEngagement>({ minutes: 135, recommendedMinutes: RECOMMENDED_WEEKLY_MIN });

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        if ((ClassesService as any)?.getSubjectAveragesForStudent) {
          const d = await (ClassesService as any).getSubjectAveragesForStudent(student.id, student.classId);
          if (!cancel && d) setSubjectPerf(d);
        }
        const aAny = AssignmentService as any;
        if (aAny?.getMonthlyAverageScores) {
          const s = await aAny.getMonthlyAverageScores(student.id);
          if (!cancel && s) setMonthly(s);
        }
        if (aAny?.getSubmissionStatsForStudent) {
          const st = await aAny.getSubmissionStatsForStudent(student.id);
          if (!cancel && st) setSubs(st);
        }
        if ((StudyTimeService as any)?.getWeeklyEngagementForStudent) {
          const w = await (StudyTimeService as any).getWeeklyEngagementForStudent(student.id);
          if (!cancel && w) setWeekly({ minutes: w.minutes ?? 0, recommendedMinutes: w.recommendedMinutes ?? RECOMMENDED_WEEKLY_MIN });
        }
      } catch {/* demo stays */}
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
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subjectPerf}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="subject" /><YAxis /><Tooltip /><Legend />
              <Bar dataKey="childAvg" name={student.name} />
              <Bar dataKey="classAvg" name="Class avg" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />Parent engagement</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{(weekly.minutes / 60).toFixed(1)}h</div>
            <p className="text-sm text-muted-foreground mt-2">Recommended {(weekly.recommendedMinutes / 60).toFixed(1)}h/wk</p>
            <Badge variant={weekly.minutes >= weekly.recommendedMinutes ? ("success" as any) : "secondary"}>
              {weekly.minutes >= weekly.recommendedMinutes ? "On track" : "Add a bit more"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Submission rate</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={80} label>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <p className="text-sm text-muted-foreground mt-2">Low rates can prompt teacher outreach.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Grade improvement</CardTitle></CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthly}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" /><YAxis domain={[0,100]} /><Tooltip /><Legend />
                <Line type="monotone" dataKey="avgScore" name="Monthly avg" dot />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-sm text-muted-foreground mt-2">If flat/declining, consider asking for help.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

type ClassRankingRow = { studentId: string; studentName: string; subject: Subject; rank: number; avgScore: number; };

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
  useEffect(() => {
    let cancel=false;
    (async()=>{
      try {
        if ((ClassesService as any)?.getSubjectRankingsForClass) {
          const data = await (ClassesService as any).getSubjectRankingsForClass(classId);
          if (!cancel && data) setRankRows(data);
        } else {
          // build simple rankings from current rows by overall avg as Math
          const basic = rows.map((r,i)=>({ studentId:r.id, studentName:r.name, subject:"Overall" as Subject, rank:0, avgScore:r.avgScore }));
          basic.sort((a,b)=>b.avgScore-a.avgScore).forEach((r,i)=>r.rank=i+1);
          if (!cancel) setRankRows(basic);
        }
      } catch {}
    })();
    return () => { cancel=true; };
  }, [classId, rows]);

  const filtered = rows.filter(r => r.name.toLowerCase().includes(qText.toLowerCase()));

  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={(v)=>setTab(v as any)}>
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rankings">Rankings</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <OverviewHeader rows={rows} />
        </TabsContent>

        {/* RANKINGS (your previous table kept) */}
        <TabsContent value="rankings">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Subject-wise rankings</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue={subjects[0] ?? "Overall"}>
                <TabsList className="flex flex-wrap">
                  {subjects.map(s => <TabsTrigger key={s} value={s}>{s}</TabsTrigger>)}
                </TabsList>
                {subjects.map(s => {
                  const byS = rankRows.filter(r => r.subject === s).sort((a,b)=>a.rank-b.rank);
                  const show = byS.length ? byS : rankRows; // fallback
                  return (
                    <TabsContent key={s} value={s}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead><tr className="text-left border-b">
                            <th className="py-2 pr-4">Rank</th>
                            <th className="py-2 pr-4">Student</th>
                            <th className="py-2 pr-4">Avg</th>
                            <th className="py-2 pr-4">Action</th>
                          </tr></thead>
                          <tbody>
                            {show.map(r=>(
                              <tr key={`${r.studentId}-${r.subject}`} className="border-b">
                                <td className="py-2 pr-4">{r.rank}</td>
                                <td className="py-2 pr-4">{r.studentName}</td>
                                <td className="py-2 pr-4">{Math.round(r.avgScore)}</td>
                                <td className="py-2 pr-4">
                                  <Button size="sm" onClick={()=>setSelected({ id:r.studentId, name:r.studentName, classId })}>View details</Button>
                                </td>
                              </tr>
                            ))}
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

        {/* STUDENTS LIST (mock lookalike) */}
        <TabsContent value="students">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2 justify-between">
                <CardTitle>Students</CardTitle>
                <div className="flex gap-2">
                  <Input placeholder="Search…" value={qText} onChange={(e)=>setQText(e.target.value)} className="w-56" />
                  {/* If you support multi-class, add a Select for classId here */}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm align-middle">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4 w-10"></th>
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Group</th>
                      <th className="py-2 pr-4">Grade</th>
                      <th className="py-2 pr-4">Curriculum Progress</th>
                      <th className="py-2 pr-4">Submission Rate</th>
                      <th className="py-2 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(r=>(
                      <tr key={r.id} className="border-b hover:bg-muted/40">
                        <td className="py-2 pr-4">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={undefined} />
                            <AvatarFallback>{initials(r.name)}</AvatarFallback>
                          </Avatar>
                        </td>
                        <td className="py-2 pr-4 font-medium">{r.name}</td>
                        <td className="py-2 pr-4">{r.classId}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={r.avgScore>=85?"success":r.avgScore>=60?"secondary":"destructive"}>
                            {r.avgScore}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 w-48">
                          <Sparkline data={r.monthlySeries} />
                        </td>
                        <td className="py-2 pr-4 w-40">
                          <div className="flex items-center gap-2">
                            <div className="h-2 flex-1 bg-muted rounded">
                              <div className="h-2 rounded bg-primary" style={{ width: `${r.submissionRate}%` }} />
                            </div>
                            <span className="text-xs text-muted-foreground">{r.submissionRate}%</span>
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <Button variant="ghost" size="icon" onClick={()=>setSelected({ id:r.id, name:r.name, classId })}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Student drill‑down (reuse Guardian charts) */}
      <Dialog open={!!selected} onOpenChange={()=>setSelected(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{selected?.name}</DialogTitle></DialogHeader>
          {selected && <GuardianSection student={selected} />}
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
    loadTeacherClasses();
  }, [user?.uid, role, teacherClasses.length, selectedClass, setSelectedClass, setTeacherClasses]);

  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metrics</h1>
          <p className="text-muted-foreground">
            {role === "teacher" || role === "admin"
              ? selectedClass ? `Class insights for ${selectedClass.name}` : "Select a class to view insights"
              : (student ? `Insights for ${student.name}` : "Loading…")}
          </p>
        </div>

        {/* Only show picker for teacher/admin */}
        {(role === "teacher" || role === "admin") && (
          <ClassPicker
            teacherClasses={teacherClasses}
            selectedId={selectedClass?.id}
            onChange={(id) => {
              const cls = teacherClasses.find(c => c.id === id) || null;
              setSelectedClass(cls);
            }}
          />
        )}
      </div>

      {/* Teacher vs Guardian sections */}
      {(role === "teacher" || role === "admin")
        ? (selectedClass
            ? <TeacherSection classId={selectedClass.id} />
            : <Card><CardContent className="py-8">Select a class to view rankings.</CardContent></Card>)
        : (student
            ? <GuardianSection student={student} />
            : <Card><CardContent className="py-8">No student found for this account.</CardContent></Card>)
      }
    </div>
  );
//   return (
//     <div className="space-y-6">
//       <div>
//         <h1 className="text-3xl font-bold tracking-tight">Metrics</h1>
//         <p className="text-muted-foreground">
//           {role === "teacher" ? "Class insights & student detail" :
//            student ? `Insights for ${student.name}` : "Loading..."}
//         </p>
//       </div>

//       {role === "teacher"
//         ? (classId ? <TeacherSection classId={classId} /> :
//             <Card><CardContent className="py-8">Choose a class to view rankings.</CardContent></Card>)
//         : (student ? <GuardianSection student={student} /> :
//             <Card><CardContent className="py-8">No student found for this account.</CardContent></Card>)
//       }
//     </div>
//   );
};
