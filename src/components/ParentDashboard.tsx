import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar, BookOpen, Bell, Clock, CheckCircle, AlertCircle, Pin, Tag as TagIcon
} from "lucide-react";

// ---- storage keys (match the feature pages)
const ASSIGNMENTS_KEY = "assignments";       // from AssignmentPage
const FORUM_KEY = "forum_posts_v1";          // from Forum/AnnouncementPage

// ---- lightweight shapes (subset of your page types)
type Status = "pending" | "completed" | "overdue";
type Assignment = {
  id: string;
  title: string;
  dueDate: string;        // ISO yyyy-mm-dd
  status: Status;
  subject?: string;
  createdAt?: string;     // ISO
};

type Tag = "general" | "question" | "advice" | "event" | "policy";
type Post = {
  id: string;
  title: string;
  body: string;
  tag: Tag;
  authorName: string;
  createdAt: string;      // ISO
  isPinned: boolean;
  score: number;
};

// ---- helpers
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
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
  // isoDate is "YYYY-MM-DD"
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(isoDate); due.setHours(0,0,0,0);
  const diffDays = Math.round((+due - +today) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  return due.toLocaleDateString();
}
function tagClasses(t: Tag) {
  switch (t) {
    case "question": return "bg-blue-100 text-blue-700";
    case "advice":   return "bg-emerald-100 text-emerald-700";
    case "event":    return "bg-violet-100 text-violet-700";
    case "policy":   return "bg-red-100 text-red-700";
    default:         return "bg-slate-100 text-slate-700";
  }
}

interface ParentDashboardProps {
  onNavigate: (page: "assignments" | "announcements") => void;
}

export const ParentDashboard = ({ onNavigate }: ParentDashboardProps) => {
  // ---- pull live data from localStorage (keeps dashboard in sync with pages)
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    const a = safeParse<Assignment[]>(localStorage.getItem(ASSIGNMENTS_KEY), []);
    const p = safeParse<Post[]>(localStorage.getItem(FORUM_KEY), []);
    setAssignments(a);
    setPosts(p);
  }, []);

  // ---- derived assignment data
  const activeAssignments = useMemo(
    () => assignments.filter(a => a.status !== "completed"),
    [assignments]
  );

  const completedThisWeek = useMemo(() => {
    const weekAgo = Date.now() - 7 * 24 * 3600 * 1000;
    return assignments.filter(a =>
      a.status === "completed" &&
      (a.createdAt ? new Date(a.createdAt).getTime() >= weekAgo : true)
    ).length;
  }, [assignments]);

  const nextAssignments = useMemo(() => {
    return activeAssignments
      .slice()
      .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate))
      .slice(0, 3);
  }, [activeAssignments]);

  // ---- derived forum data
  const newPosts48h = useMemo(() => {
    const cutoff = Date.now() - 48 * 3600 * 1000;
    return posts.filter(p => new Date(p.createdAt).getTime() >= cutoff).length;
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

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Good morning, Sarah! 👋
        </h1>
        <p className="text-muted-foreground">
          Emma has {activeAssignments.length} active assignment{activeAssignments.length === 1 ? "" : "s"} and {newPosts48h} new forum post{newPosts48h === 1 ? "" : "s"}.
        </p>
      </div>

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("assignments")}
          >
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

      {/* Recent Forum Posts (replaces "Announcements") */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-warning" />
            <span>Recent Forum Posts</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate("announcements")}
          >
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
                    <p className="text-sm text-muted-foreground">
                      {timeAgo(p.createdAt)} • by {p.authorName}
                    </p>
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
