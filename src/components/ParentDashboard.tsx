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

// ---- storage keys (match the feature pages)
const ASSIGNMENTS_KEY = "assignments"; // from AssignmentPage
const FORUM_KEY = "forum_posts_v1"; // from Forum/AnnouncementPage
const DAILY_KEY = "parent_daily_stats_v1"; // new
const GOAL_KEY = "kid_goal_v1"; // new

type Status = "pending" | "completed" | "overdue";

type Assignment = {
  id: string;
  title: string;
  dueDate: string; // ISO yyyy-mm-dd
  status: Status;
  subject?: string;
  createdAt?: string; // ISO
  submissions?: { submittedAt: string }[];
};

type Tag = "general" | "question" | "advice" | "event" | "policy";

type Post = {
  id: string;
  title: string;
  body: string;
  tag: Tag;
  authorName: string;
  createdAt: string; // ISO
  isPinned: boolean;
  score: number;
};

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
function timeAgo(iso: string): string {
  const d = new Date(iso);
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return d.toLocaleDateString();
}
function dueLabel(isoDate: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(isoDate);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((+due - +today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return due.toLocaleDateString();
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
  const d = new Date(isoDate);
  return d.toLocaleDateString(undefined, { weekday: "short" });
}
function addDays(base: Date, delta: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + delta);
  return d;
}
function isoDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
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
    const v = (rows[i] as any)[metric] as number;
    if (v >= goal) set.add(rows[i].date);
    else break;
  }
  return set;
}

interface ParentDashboardProps {
  onNavigate: (page: "assignments" | "announcements") => void;
}

export const ParentDashboard = ({ onNavigate }: ParentDashboardProps) => {
  // ---- pull live data from localStorage (keeps dashboard in sync with pages)
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  // Daily data & goals
  const [days, setDays] = useState<DayRow[]>([]);
  const [metric, setMetric] = useState<"minutes" | "tasks">("minutes");
  const [goal, setGoal] = useState<GoalState>({ minutes: 30, tasks: 1 });

  useEffect(() => {
    const a = safeParse<Assignment[]>(localStorage.getItem(ASSIGNMENTS_KEY), []);
    const p = safeParse<Post[]>(localStorage.getItem(FORUM_KEY), []);
    setAssignments(a);
    setPosts(p);

    // seed or load daily rows
    let rows = safeParse<DayRow[]>(localStorage.getItem(DAILY_KEY), []);

    if (!rows.length) {
      // seed with 21 days around a gentle upward trend
      rows = synthesizeRows(21, { minM: 10, maxM: 55, minT: 0, maxT: 3 });
    }

    // augment rows using real assignment data (submissions → tasks/minutes)
    // Heuristic: each submission = 20 minutes; completing without submission = 15 minutes
    const eventsByDay: Record<string, { tasks: number; minutes: number }> = {};
    a.forEach((as) => {
      (as.submissions || []).forEach((s) => {
        const d = new Date(s.submittedAt);
        const key = isoDay(d);
        eventsByDay[key] = eventsByDay[key] || { tasks: 0, minutes: 0 };
        eventsByDay[key].tasks += 1;
        eventsByDay[key].minutes += 20;
      });
      if (as.status === "completed" && !as.submissions?.length && as.createdAt) {
        const key = as.createdAt;
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
  }, []);

  useEffect(() => {
    localStorage.setItem(GOAL_KEY, JSON.stringify(goal));
  }, [goal]);

  const activeAssignments = useMemo(() => assignments.filter((a) => a.status !== "completed"), [assignments]);

  const completedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return assignments.filter(
      (a) => a.status === "completed" && (a.createdAt ? new Date(a.createdAt).getTime() >= weekAgo : true)
    ).length;
  }, [assignments]);

  const nextAssignments = useMemo(() => {
    return activeAssignments
      .slice()
      .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))
      .slice(0, 3);
  }, [activeAssignments]);

  const newPosts48h = useMemo(() => {
    const cutoff = Date.now() - 48 * 3600 * 1000;
    return posts.filter((p) => new Date(p.createdAt).getTime() >= cutoff).length;
  }, [posts]);

  const recentPosts = useMemo(() => {
    return posts
      .slice()
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return +new Date(b.createdAt) - +new Date(a.createdAt);
      })
      .slice(0, 3);
  }, [posts]);

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

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">Good morning, Sarah! 👋</h1>
        <p className="text-muted-foreground">
          Emma has {activeAssignments.length} active assignment{activeAssignments.length === 1 ? "" : "s"} and {newPosts48h} new forum post{newPosts48h === 1 ? "" : "s"}.
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
                  formatter={(value: any) => [`${value}`, metric === "minutes" ? "minutes" : "tasks"]}
                  labelFormatter={(l) => new Date(l).toLocaleDateString()}
                />
                <ReferenceLine y={currentGoal} stroke="#10b981" strokeDasharray="3 3" />
                <Bar dataKey={metric} radius={[6, 6, 0, 0]}>
                  {last14.map((r, idx) => {
                    const v = (r as any)[metric] as number;
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
                <p className="text-2xl font-bold">{newPosts48h}</p>
                <p className="text-sm text-muted-foreground">New Posts (48h)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Assignments (live) */}
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
            nextAssignments.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center space-x-3">
                  {a.status === "completed" ? (
                    <CheckCircle className="h-5 w-5 text-success" />
                  ) : (
                    <Clock className={`h-5 w-5 ${a.status === "overdue" ? "text-red-600" : "text-warning"}`} />
                  )}
                  <div>
                    <h4 className="font-medium text-foreground">{a.title}</h4>
                    <p className="text-sm text-muted-foreground">Due: {dueLabel(a.dueDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.subject && <Badge variant="outline">{a.subject}</Badge>}
                  <Badge variant={a.status === "completed" ? "default" : a.status === "overdue" ? "destructive" : "secondary"}>
                    {a.status === "completed" ? "✅ Done" : a.status === "overdue" ? "⏰ Overdue" : "📝 Pending"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Recent Forum Posts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-warning" />
            <span>Recent Forum Posts</span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => onNavigate("announcements")}>
            View All
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentPosts.length === 0 ? (
            <div className="text-sm text-muted-foreground">No posts yet.</div>
          ) : (
            recentPosts.map((p) => (
              <div
                key={p.id}
                className={`flex items-center justify-between p-3 rounded-lg bg-muted/50 ${p.isPinned ? "border-l-4 border-l-amber-500" : ""}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {p.isPinned ? (
                    <Pin className="h-5 w-5 text-amber-600 shrink-0" />
                  ) : p.tag === "event" ? (
                    <Calendar className="h-5 w-5 text-primary shrink-0" />
                  ) : p.tag === "policy" ? (
                    <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                  ) : (
                    <TagIcon className="h-5 w-5 text-muted-foreground shrink-0" />
                  )}
                  <div className="min-w-0">
                    <h4 className="font-medium text-foreground truncate">{p.title}</h4>
                    <p className="text-sm text-muted-foreground">{timeAgo(p.createdAt)} • by {p.authorName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  <Badge className={tagClasses(p.tag)}>{p.tag}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
};
