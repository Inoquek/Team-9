import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  BookOpen,
  Bell,
  Clock,
  CheckCircle,
  AlertCircle,
  Pin,
  Tag as TagIcon,
  Flame,
  Eye,
  MessageCircle,
  File,
  Download,
  Sprout,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AssignmentService } from "@/lib/services/assignments";
import { AnnouncementService } from "@/lib/services/announcements";
import { Assignment, AssignmentWithComments, AnnouncementWithComments, Comment } from "@/lib/types";
import { CommentSection } from "./CommentSection";
import { FileViewer } from "./FileViewer";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

// ---- storage keys (match the feature pages)
const DAILY_KEY = "parent_daily_stats_v1"; // new
const GOAL_KEY = "kid_goal_v1"; // new

type Status = "pending" | "completed" | "overdue";

type Tag = "general" | "question" | "advice" | "event" | "policy";

type DayRow = { date: string; minutes: number; tasks: number };

type GoalState = { minutes: number; tasks: number };

// ---- helpers
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function timeAgo(date: Date | string | { toDate: () => Date } | null | undefined): string {
  try {
    let d: Date;
    
    // Handle Firestore Timestamp
    if (date && typeof date === 'object' && 'toDate' in date && typeof date.toDate === 'function') {
      d = date.toDate();
    }
    // Handle Date object
    else if (date instanceof Date) {
      d = date;
    }
    
    // Handle string dates
    else if (typeof date === 'string') {
      d = new Date(date);
      if (isNaN(d.getTime())) {
        return 'Invalid date';
      }
    }
    // Handle null/undefined
    else {
      return 'Unknown time';
    }
    
    const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return d.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting time ago:', error);
    return 'Unknown time';
  }
}

function dueLabel(dueDate: Date | string | { toDate: () => Date } | null | undefined): string {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let due: Date;
    
    // Handle Firestore Timestamp
    if (dueDate && typeof dueDate === 'object' && 'toDate' in dueDate && typeof dueDate.toDate === 'function') {
      due = dueDate.toDate();
    }
    // Handle Date object
    else if (dueDate instanceof Date) {
      due = dueDate;
    }
    // Handle string dates
    else if (typeof dueDate === 'string') {
      due = new Date(dueDate);
      if (isNaN(due.getTime())) {
        return 'Invalid date';
      }
    }
    // Handle null/undefined
    else {
      return 'No due date';
    }
    
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((+due - +today) / 86400000);
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays === -1) return "Yesterday";
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    return due.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting due date:', error);
    return 'Invalid date';
  }
}

function tagClasses(t: Tag) {
  switch (t) {
    case "question":
      return "bg-blue-100 text-blue-700";
    case "advice":
      return "bg-emerald-100 text-emerald-700";
    case "event":
      return "bg-violet-100 text-violet-700";
    case "policy":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatShortDay(isoDate: string) {
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) {
      return 'Invalid';
    }
    return d.toLocaleDateString(undefined, { weekday: "short" });
  } catch (error) {
    console.error('Error formatting short day:', error);
    return 'Invalid';
  }
}

function addDays(base: Date, delta: number) {
  try {
    const d = new Date(base);
    if (isNaN(d.getTime())) {
      return new Date();
    }
    d.setDate(d.getDate() + delta);
    return d;
  } catch (error) {
    console.error('Error adding days:', error);
    return new Date();
  }
}

function isoDay(d: Date) {
  try {
    const x = new Date(d);
    if (isNaN(x.getTime())) {
      return new Date().toISOString().slice(0, 10);
    }
    x.setHours(0, 0, 0, 0);
    return x.toISOString().slice(0, 10);
  } catch (error) {
    console.error('Error formatting ISO day:', error);
    return new Date().toISOString().slice(0, 10);
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

// Create nice-looking demo rows when storage is empty or when user taps "Add more data"
function synthesizeRows(days: number, seedBias: { minM: number; maxM: number; minT: number; maxT: number }): DayRow[] {
  const today = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = addDays(today, -((days - 1) - i));
    const minutes = Math.round(
      clamp(
        seedBias.minM + Math.random() * (seedBias.maxM - seedBias.minM),
        0,
        240
      )
    );
    const tasks = Math.round(
      clamp(seedBias.minT + Math.random() * (seedBias.maxT - seedBias.minT), 0, 6)
    );
    return { date: isoDay(d), minutes, tasks };
  });
}

// Merge two day series by date (later wins)
function mergeSeries(a: DayRow[], b: DayRow[]): DayRow[] {
  const map = new Map<string, DayRow>();
  [...a, ...b].forEach((r) => map.set(r.date, r));
      return Array.from(map.values()).sort((x, y) => x.date.localeCompare(y.date));
}

// Compute the most recent streak where value >= goal
function computeStreak(rows: DayRow[], metric: keyof DayRow, goal: number): Set<string> {
  const set = new Set<string>();
  for (let i = rows.length - 1; i >= 0; i--) {
    const v = (rows[i] as DayRow)[metric] as number;
    if (v >= goal) set.add(rows[i].date);
    else break;
  }
  return set;
}

interface ParentDashboardProps {
  onNavigate: (page: "assignments" | "announcements" | "parentGarden") => void;
  onBadgeCountsUpdate: (counts: { assignments: number; announcements: number }) => void;
}

export const ParentDashboard = ({ onNavigate, onBadgeCountsUpdate }: ParentDashboardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Real data from Firebase
  const [assignments, setAssignments] = useState<AssignmentWithComments[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementWithComments[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Daily data & goals
  const [days, setDays] = useState<DayRow[]>([]);
  const [metric, setMetric] = useState<"minutes" | "tasks">("minutes");
  const [goal, setGoal] = useState<GoalState>({ minutes: 30, tasks: 1 });

  // Load real data from Firebase
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const assignmentsData: AssignmentWithComments[] = [];
        const announcementsData: AnnouncementWithComments[] = [];

        // Get parent's student(s) first
        const studentsQuery = query(
          collection(db, 'students'),
          where('parentId', '==', user.uid),
          where('isActive', '==', true)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        // Get assignments and announcements from student's class
        for (const studentDoc of studentsSnapshot.docs) {
          const studentData = studentDoc.data() as { classId: string };
          if (studentData.classId) {
            try {
              // Load assignments
              const classAssignments = await AssignmentService.getClassAssignmentsWithComments(studentData.classId);
              assignmentsData.push(...classAssignments);
              
              // Load announcements
              const classAnnouncements = await AnnouncementService.getClassAnnouncementsWithComments(studentData.classId);
              announcementsData.push(...classAnnouncements);
            } catch (error) {
              console.error('Error loading class data:', error);
            }
          }
        }
        
        setAssignments(assignmentsData);
        setAnnouncements(announcementsData);

        // seed or load daily rows
        let rows = safeParse<DayRow[]>(localStorage.getItem(DAILY_KEY), []);

        if (!rows.length) {
          // seed with 21 days around a gentle upward trend
          rows = synthesizeRows(21, { minM: 10, maxM: 55, minT: 0, maxT: 3 });
        }

        // augment rows using real assignment data (submissions → tasks/minutes)
        // Heuristic: each submission = 20 minutes; completing without submission = 15 minutes
        const eventsByDay: Record<string, { tasks: number; minutes: number }> = {};
        assignmentsData.forEach((assignment) => {
          // For now, we'll use a simple heuristic based on assignment completion
          // In a real app, you'd track actual time spent and submissions
          if (assignment.status === "active") {
            const key = isoDay(new Date());
            eventsByDay[key] = eventsByDay[key] || { tasks: 0, minutes: 0 };
            eventsByDay[key].tasks += 1;
            eventsByDay[key].minutes += 15;
          }
        });
        
        const realRows: DayRow[] = Object.keys(eventsByDay).map((d) => ({
          date: d,
          minutes: eventsByDay[d].minutes,
          tasks: eventsByDay[d].tasks,
        }));

        const merged = mergeSeries(rows, realRows);
        setDays(merged);

        const savedGoal = safeParse<GoalState>(localStorage.getItem(GOAL_KEY), { minutes: 30, tasks: 1 });
        setGoal(savedGoal);

        // persist the (possibly extended) rows
        localStorage.setItem(DAILY_KEY, JSON.stringify(merged));
      } catch (error) {
        console.error('Error loading parent data:', error);
        toast({
          title: "Error",
          description: "Failed to load data. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, toast]);

  useEffect(() => {
    localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
  }, [goal]);

  // Update badge counts whenever assignments or announcements change
  useEffect(() => {
    if (!isLoading) {
      const activeAssignmentsCount = assignments.filter(a => a.status === "active").length;
      const newAnnouncementsCount = announcements.filter(a => {
        try {
          const cutoff = Date.now() - 48 * 3600 * 1000;
          let createdAt: Date;
          
          if (a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt && typeof a.createdAt.toDate === 'function') {
            createdAt = a.createdAt.toDate();
          } else if (a.createdAt instanceof Date) {
            createdAt = a.createdAt;
          } else if (typeof a.createdAt === 'string') {
            createdAt = new Date(a.createdAt);
            if (isNaN(createdAt.getTime())) return false;
          } else {
            return false;
          }
          
          return createdAt.getTime() >= cutoff;
        } catch (error) {
          return false;
        }
      }).length;

      onBadgeCountsUpdate({
        assignments: activeAssignmentsCount,
        announcements: newAnnouncementsCount
      });
    }
  }, [assignments, announcements, isLoading, onBadgeCountsUpdate]);

  const activeAssignments = useMemo(() => assignments.filter((a) => a.status === "active"), [assignments]);

  const completedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return assignments.filter((a) => {
      try {
        if (a.status !== "archived") return false;
        
        let createdAt: Date;
        // Handle Firestore Timestamp
        if (a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt && typeof a.createdAt.toDate === 'function') {
          createdAt = a.createdAt.toDate();
        }
        // Handle Date object
        else if (a.createdAt instanceof Date) {
          createdAt = a.createdAt;
        }
        // Handle string dates
        else if (typeof a.createdAt === 'string') {
          createdAt = new Date(a.createdAt);
          if (isNaN(createdAt.getTime())) return false;
        }
        // Handle null/undefined
        else {
          return false;
        }
        
        return createdAt.getTime() >= weekAgo;
      } catch (error) {
        console.error('Error processing assignment createdAt:', error);
        return false;
      }
    }).length;
  }, [assignments]);

  const nextAssignments = useMemo(() => {
    return activeAssignments
      .slice()
      .sort((a, b) => {
        try {
          let aDate: Date, bDate: Date;
          
          // Handle assignment a dueDate
          if (a.dueDate && typeof a.dueDate === 'object' && 'toDate' in a.dueDate && typeof a.dueDate.toDate === 'function') {
            aDate = a.dueDate.toDate();
          } else if (a.dueDate instanceof Date) {
            aDate = a.dueDate;
          } else if (typeof a.dueDate === 'string') {
            aDate = new Date(a.dueDate);
            if (isNaN(aDate.getTime())) aDate = new Date();
          } else {
            aDate = new Date();
          }
          
          // Handle assignment b dueDate
          if (b.dueDate && typeof b.dueDate === 'object' && 'toDate' in b.dueDate && typeof b.dueDate.toDate === 'function') {
            bDate = b.dueDate.toDate();
          } else if (b.dueDate instanceof Date) {
            bDate = b.dueDate;
          } else if (typeof b.dueDate === 'string') {
            bDate = new Date(b.dueDate);
            if (isNaN(bDate.getTime())) bDate = new Date();
          } else {
            bDate = new Date();
          }
          
          return aDate.getTime() - bDate.getTime();
        } catch (error) {
          console.error('Error sorting assignments by due date:', error);
          return 0;
        }
      })
      .slice(0, 3);
  }, [activeAssignments]);

  const newAnnouncements48h = useMemo(() => {
    const cutoff = Date.now() - 48 * 3600 * 1000;
    return announcements.filter((a) => {
      try {
        let createdAt: Date;
        // Handle Firestore Timestamp
        if (a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt && typeof a.createdAt.toDate === 'function') {
          createdAt = a.createdAt.toDate();
        }
        // Handle Date object
        else if (a.createdAt instanceof Date) {
          createdAt = a.createdAt;
        }
        // Handle string dates
        else if (typeof a.createdAt === 'string') {
          createdAt = new Date(a.createdAt);
          if (isNaN(createdAt.getTime())) return false;
        }
        // Handle null/undefined
        else {
          return false;
        }
        
        return createdAt.getTime() >= cutoff;
      } catch (error) {
        console.error('Error processing announcement createdAt:', error);
        return false;
      }
    }).length;
  }, [announcements]);

  const recentAnnouncements = useMemo(() => {
    return announcements
      .slice()
      .sort((a, b) => {
        try {
          let aDate: Date, bDate: Date;
          
          // Handle announcement a createdAt
          if (a.createdAt && typeof a.createdAt === 'object' && 'toDate' in a.createdAt && typeof a.createdAt.toDate === 'function') {
            aDate = a.createdAt.toDate();
          } else if (a.createdAt instanceof Date) {
            aDate = a.createdAt;
          } else if (typeof a.createdAt === 'string') {
            aDate = new Date(a.createdAt);
            if (isNaN(aDate.getTime())) aDate = new Date();
          } else {
            aDate = new Date();
          }
          
          // Handle announcement b createdAt
          if (b.createdAt && typeof b.createdAt === 'object' && 'toDate' in b.createdAt && typeof b.createdAt.toDate === 'function') {
            bDate = b.createdAt.toDate();
          } else if (b.createdAt instanceof Date) {
            bDate = b.createdAt;
          } else if (typeof b.createdAt === 'string') {
            bDate = new Date(b.createdAt);
            if (isNaN(bDate.getTime())) bDate = new Date();
          } else {
            bDate = new Date();
          }
          
          return bDate.getTime() - aDate.getTime();
        } catch (error) {
          console.error('Error sorting announcements by createdAt:', error);
          return 0;
        }
      })
      .slice(0, 3);
  }, [announcements]);

  // ---- chart prep (last 14 days)
  const last14 = useMemo(() => {
    const today = new Date();
    const start = isoDay(addDays(today, -13));
    const wanted = new Set<string>();
    for (let i = -13; i <= 0; i++) wanted.add(isoDay(addDays(today, i)));
    const byDate = new Map(days.map((d) => [d.date, d] as const));
    const arr: DayRow[] = Array.from(wanted).sort().map((d) => byDate.get(d) || { date: d, minutes: 0, tasks: 0 });
    return arr;
  }, [days]);

  const currentGoal = metric === "minutes" ? goal.minutes : goal.tasks;
  const streakSet = useMemo(() => computeStreak(last14, metric, currentGoal), [last14, metric, currentGoal]);

  function addMoreData() {
    // append 7 more synthetic days before the earliest we have, then persist
    const earliest = last14[0]?.date || isoDay(addDays(new Date(), -13));
    const firstDate = new Date(earliest);
    const olderStart = addDays(firstDate, -7);
    const synth = synthesizeRows(7, { minM: 15, maxM: 65, minT: 0, maxT: 4 }).map((r, i) => ({
      ...r,
      date: isoDay(addDays(olderStart, i)),
    }));
    const merged = mergeSeries(days, synth);
    setDays(merged);
    localStorage.setItem(DAILY_KEY, JSON.stringify(merged));
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Good morning, {user?.displayName || 'Parent'}! 👋</h1>
        <p className="text-muted-foreground">
          Your child has {activeAssignments.length} active assignment{activeAssignments.length === 1 ? "" : "s"} and {newAnnouncements48h} new announcement{newAnnouncements48h === 1 ? "" : "s"}.
        </p>
      </div>

      {/* Daily Learning Streak */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" /> Daily Learning Streak
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <Button variant={metric === "minutes" ? "default" : "outline"} size="sm" onClick={() => setMetric("minutes")}>Minutes</Button>
              <Button variant={metric === "tasks" ? "default" : "outline"} size="sm" onClick={() => setMetric("tasks")}>Tasks</Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Goal</span>
              <Input
                type="number"
                value={currentGoal}
                onChange={(e) => {
                  const v = Math.max(0, Number(e.target.value || 0));
                  setGoal((g) => (metric === "minutes" ? { ...g, minutes: v } : { ...g, tasks: v }));
                }}
                className="h-8 w-20"
              />
            </div>
            <Button variant="outline" size="sm" onClick={addMoreData}>Add more data</Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="h-48 sm:h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={last14} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatShortDay}
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[0, metric === "minutes" ? 120 : 6]} />
                <Tooltip
                  formatter={(value: number) => [`${value}`, metric === "minutes" ? "minutes" : "tasks"]}
                  labelFormatter={(l) => new Date(l).toLocaleDateString()}
                />
                <ReferenceLine y={currentGoal} stroke="#10b981" strokeDasharray="3 3" />
                <Bar dataKey={metric} radius={[6, 6, 0, 0]}>
                  {last14.map((r, idx) => {
                    const v = (r as DayRow)[metric] as number;
                    const hit = v >= currentGoal;
                    const inStreak = streakSet.has(r.date);
                    const color = hit ? (inStreak ? "#22c55e" : "#86efac") : "#60a5fa";
                    return <Cell key={`c-${idx}`} fill={color} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Bars at/above the green goal line count toward the current streak (highlighted brighter).
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{activeAssignments.length}</p>
                <p className="text-sm text-muted-foreground">Active Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{completedThisWeek}</p>
                <p className="text-sm text-muted-foreground">Completed This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Bell className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">{newAnnouncements48h}</p>
                <p className="text-sm text-muted-foreground">New Announcements (48h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Assignments (live from Firebase) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Recent Assignments</span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => onNavigate("assignments")}>
            View All
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {nextAssignments.length === 0 ? (
            <div className="text-sm text-muted-foreground">No upcoming assignments.</div>
          ) : (
            nextAssignments.map((assignment) => (
              <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center space-x-3">
                  {assignment.status === "archived" ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <Clock className="h-5 w-5 text-warning" />
                  )}
                  <div>
                    <h4 className="font-medium text-foreground">{assignment.title}</h4>
                    <p className="text-sm text-muted-foreground">Due: {dueLabel(assignment.dueDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{assignment.type}</Badge>
                  <Badge variant={assignment.status === "archived" ? "default" : "secondary"}>
                    {assignment.status === "archived" ? "✅ Done" : "📝 Pending"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recent Announcements (live from Firebase) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-warning" />
            <span>Recent Announcements</span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => onNavigate("announcements")}>
            View All
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentAnnouncements.length === 0 ? (
            <div className="text-sm text-muted-foreground">No announcements yet.</div>
          ) : (
            recentAnnouncements.map((announcement) => (
              <div
                key={announcement.id}
                className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 ${announcement.priority === "high" ? "border-l-4 border-l-red-500" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {announcement.priority === "high" ? (
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                  ) : announcement.type === "event" ? (
                    <Calendar className="h-5 w-5 text-primary shrink-0" />
                  ) : announcement.type === "reminder" ? (
                    <Clock className="h-5 w-5 text-warning shrink-0" />
                  ) : (
                    <Bell className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h4 className="font-medium text-foreground truncate">{announcement.title}</h4>
                    <p className="text-sm text-muted-foreground">{timeAgo(announcement.createdAt)} • {announcement.priority} priority</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Badge className={tagClasses(announcement.type as Tag)}>{announcement.type}</Badge>
                  {announcement.commentCount && announcement.commentCount > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageCircle className="h-3 w-3" />
                      {announcement.commentCount}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Garden Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Sprout className="h-5 w-5 text-emerald-600" />
            <span>My Children's Garden</span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => onNavigate("parentGarden")}>
            View Garden
          </Button>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 rounded-full flex items-center justify-center">
              <Sprout className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">Watch Your Children Grow!</h3>
            <p className="text-sm text-muted-foreground mb-4">
              See your children's learning progress and how their class is performing together.
            </p>
            <Button onClick={() => onNavigate("parentGarden")} className="bg-emerald-600 hover:bg-emerald-700">
              <Sprout className="h-4 w-4 mr-2" />
              Explore Garden
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
