import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BookOpen, Calendar, Clock, CheckCircle, Plus, Edit, Trash2, Eye, Users,
  UploadCloud, Download, Pencil, MessageCircle, Reply as ReplyIcon, Send
} from "lucide-react";

interface AssignmentPageProps {
  userRole: "parent" | "teacher";
}

type Status = "pending" | "completed" | "overdue";

// ---- GRADING
const gradeOptions = ["Excellent", "Good", "Satisfactory", "Needs Help"] as const;
type GradeValue = typeof gradeOptions[number];
type Grade = {
  value: GradeValue;
  feedback?: string;
  gradedAt: string;
  gradedBy?: string;
};

// ---- SUBJECTS (new single source of truth)
export const SUBJECTS = [
  "Alphabet recognition",
  "Vocabulary Knowledge",
  "Phonemic Awareness",
  "Point and Read",
] as const;
type Subject = typeof SUBJECTS[number];

// ---- SUBMISSION
type Submission = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  dataUrl: string; // data URL for demo persistence
  note?: string;
  submittedAt: string;
  grade?: Grade;
};

// ---- COMMENTS
type Comment = {
  id: string;
  authorRole: "parent" | "teacher";
  authorName: string;
  content: string;
  createdAt: string; // ISO
  parentId?: string | null; // null = top-level
};

type Assignment = {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  subject: Subject;            // <-- Subject type
  status: Status;
  completedBy?: number;
  totalStudents?: number;
  createdAt: string;
  submissions?: Submission[];
  comments?: Comment[];
};

const STORAGE_KEY = "assignments";

// ---------- helpers
function todayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
function autofixOverdues(arr: Assignment[]) {
  return arr.map((a) => (a.status === "pending" && a.dueDate < todayISO() ? { ...a, status: "overdue" } : a));
}
function statusBadgeClasses(status: Status) {
  if (status === "completed") return "bg-green-100 text-green-700";
  if (status === "overdue") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}
function statusIcon(status: Status) {
  if (status === "completed") return <CheckCircle className="h-4 w-4" />;
  if (status === "overdue") return <Clock className="h-4 w-4" />;
  return <BookOpen className="h-4 w-4" />;
}
function bytesToHuman(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}
function gradeBadgeClasses(v: GradeValue) {
  switch (v) {
    case "Excellent": return "bg-green-100 text-green-700";
    case "Good": return "bg-emerald-100 text-emerald-700";
    case "Satisfactory": return "bg-amber-100 text-amber-700";
    case "Needs Help": return "bg-red-100 text-red-700";
  }
}

// initial data (subjects replaced with the 4 you wanted)
const initialSeed = (role: "parent" | "teacher"): Assignment[] => [
  {
    id: "1",
    title: "Letter Recognition - A to E",
    description: "Practice identifying and writing letters A through E. Use the worksheet provided and practice writing each letter 3 times.",
    dueDate: "2025-09-01",
    status: "pending",
    subject: "Alphabet recognition",
    completedBy: role === "teacher" ? 18 : undefined,
    totalStudents: role === "teacher" ? 24 : undefined,
    createdAt: "2025-08-20",
    submissions: [],
    comments: [
      {
        id: "c1",
        authorRole: "teacher",
        authorName: "Ms. Bee",
        content: "Parents, feel free to upload a photo of the worksheet. Thanks!",
        createdAt: new Date().toISOString(),
        parentId: null
      }
    ],
  },
  {
    id: "2",
    title: "Count to 10 Practice",
    description: "Count objects around the house and write the numbers. Take photos of your counting practice to share!",
    dueDate: "2025-08-28",
    status: "completed",
    subject: "Vocabulary Knowledge",
    completedBy: role === "teacher" ? 22 : undefined,
    totalStudents: role === "teacher" ? 24 : undefined,
    createdAt: "2025-08-18",
    submissions: [],
    comments: [],
  },
  {
    id: "3",
    title: "Color Sorting Activity",
    description: "Sort household items by color. Practice naming colors and create groups of the same colored items.",
    dueDate: "2025-08-26",
    status: "pending",
    subject: "Phonemic Awareness",
    completedBy: role === "teacher" ? 5 : undefined,
    totalStudents: role === "teacher" ? 24 : undefined,
    createdAt: "2025-08-21",
    submissions: [],
    comments: [],
  },
  {
    id: "4",
    title: "Point and Read Practice",
    description: "Practice pointing to words while reading short sentences aloud together.",
    dueDate: "2025-09-05",
    status: "pending",
    subject: "Point and Read",
    completedBy: role === "teacher" ? 12 : undefined,
    totalStudents: role === "teacher" ? 24 : undefined,
    createdAt: "2025-08-22",
    submissions: [],
    comments: [],
  },
];

export const AssignmentPage = ({ userRole }: AssignmentPageProps) => {
  const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
  const [items, setItems] = useState<Assignment[]>([]);
  const [draft, setDraft] = useState<Partial<Assignment>>({
    title: "", description: "", dueDate: "", subject: undefined, status: "pending",
  });
  const [editingId, setEditingId] = useState<string | null>(null);

  // NEW: control the Create/Edit dialog
  const [isAssignDialogOpen, setAssignDialogOpen] = useState(false);

  // Submissions (parent)
  const [submitForId, setSubmitForId] = useState<string | null>(null);
  const [submitNote, setSubmitNote] = useState("");
  const [submitFiles, setSubmitFiles] = useState<File[]>([]);

  // Grading (teacher)
  const [gradeFor, setGradeFor] = useState<{ aId: string; sId: string } | null>(null);
  const [gradeValue, setGradeValue] = useState<GradeValue | "">("");
  const [gradeFeedback, setGradeFeedback] = useState("");

  // Comments
  const [commentFor, setCommentFor] = useState<{ aId: string; parentId?: string | null } | null>(null);
  const [commentText, setCommentText] = useState("");

  // LOAD/SAVE
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Assignment[];
        setItems(autofixOverdues(parsed));
        return;
      } catch { /* ignore */ }
    }
    setItems(autofixOverdues(initialSeed(userRole)));
  }, [userRole]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const filtered = useMemo(() => {
    if (filterStatus === "all") return items;
    return items.filter((a) => a.status === filterStatus);
  }, [items, filterStatus]);

  // ------------ Assignments CRUD ------------
  function openCreate() {
    setEditingId(null);
    setDraft({ title: "", description: "", dueDate: "", subject: undefined, status: "pending" });
    setAssignDialogOpen(true); // open dialog
  }
  function openEdit(a: Assignment) {
    setEditingId(a.id);
    setDraft({ ...a });
    setAssignDialogOpen(true); // open dialog
  }
  function upsertAssignment() {
    if (!draft.title || !draft.dueDate || !draft.subject) return;
    const normalized: Status =
      draft.status && ["pending", "completed", "overdue"].includes(draft.status)
        ? (draft.status as Status)
        : "pending";

    if (editingId) {
      setItems((prev) =>
        prev.map((a) => (a.id === editingId ? { ...(a as Assignment), ...(draft as Assignment), status: normalized } : a))
      );
    } else {
      const id = (crypto as any)?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      const createdAt = todayISO();
      const base: Assignment = {
        id,
        title: draft.title!,
        description: draft.description ?? "",
        dueDate: draft.dueDate!,
        subject: draft.subject as Subject,
        status: normalized,
        createdAt,
        submissions: [],
        comments: [],
      };
      setItems((prev) => [base, ...prev]);
    }
    setEditingId(null);
    setDraft({ title: "", description: "", dueDate: "", subject: undefined, status: "pending" });
    setAssignDialogOpen(false); // close on success
  }
  function deleteAssignment(id: string) {
    if (!confirm("Delete this assignment?")) return;
    setItems((prev) => prev.filter((a) => a.id !== id));
  }
  function markComplete(id: string) {
    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status: "completed" } : a)));
  }

  // ------------ Submissions (parent) ------------
  function openSubmitDialog(assignmentId: string) {
    setSubmitForId(assignmentId);
    setSubmitNote("");
    setSubmitFiles([]);
  }
  function onFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setSubmitFiles(files.slice(0, 3));
  }
  async function handleSubmitFiles() {
    if (!submitForId || submitFiles.length === 0) return;

    const MAX_MB = 2;
    for (const f of submitFiles) {
      if (f.size > MAX_MB * 1024 * 1024) {
        alert(`"${f.name}" is larger than ${MAX_MB} MB.`);
        return;
      }
      const ok = ["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic"];
      if (!ok.some((t) => f.type === t || f.type.includes(t.split("/")[1]))) {
        alert(`"${f.name}" is not a supported type (PDF or images).`);
        return;
      }
    }

    const now = new Date().toISOString();
    const converted = await Promise.all(
      submitFiles.map(async (f) => {
        const dataUrl = await fileToDataURL(f);
        const id = (crypto as any)?.randomUUID?.() ?? Math.random().toString(36).slice(2);
        const s: Submission = { id, fileName: f.name, mimeType: f.type, size: f.size, dataUrl, note: submitNote || undefined, submittedAt: now };
        return s;
      })
    );

    setItems((prev) =>
      prev.map((a) => (a.id !== submitForId ? a : { ...a, submissions: [...(a.submissions ?? []), ...converted], status: "completed" }))
    );

    setSubmitForId(null);
    setSubmitFiles([]);
    setSubmitNote("");
  }

  // ------------ Grading (teacher) ------------
  function openGradeDialog(aId: string, s: Submission) {
    setGradeFor({ aId, sId: s.id });
    setGradeValue(s.grade?.value ?? "");
    setGradeFeedback(s.grade?.feedback ?? "");
  }
  function saveGrade() {
    if (!gradeFor || !gradeValue) return;
    const now = new Date().toISOString();

    setItems((prev) =>
      prev.map((a) => {
        if (a.id !== gradeFor.aId) return a;
        const subs = (a.submissions ?? []).map((s) =>
          s.id === gradeFor.sId
            ? {
                ...s,
                grade: {
                  value: gradeValue as GradeValue,
                  feedback: gradeFeedback || undefined,
                  gradedAt: now,
                  gradedBy: "Teacher", // replace with real user later
                },
              }
            : s
        );
        return { ...a, submissions: subs };
      })
    );

    setGradeFor(null);
    setGradeValue("");
    setGradeFeedback("");
  }

  // ------------ Comments & replies ------------
  function openCommentDialog(aId: string, parentId: string | null = null) {
    setCommentFor({ aId, parentId });
    setCommentText("");
  }
  function saveComment() {
    if (!commentFor || !commentText.trim()) return;
    const now = new Date().toISOString();
    const newComment: Comment = {
      id: (crypto as any)?.randomUUID?.() ?? Math.random().toString(36).slice(2),
      authorRole: userRole,
      authorName: userRole === "teacher" ? "Teacher" : "Parent",
      content: commentText.trim(),
      createdAt: now,
      parentId: commentFor.parentId ?? null,
    };

    setItems((prev) =>
      prev.map((a) =>
        a.id !== commentFor.aId
          ? a
          : { ...a, comments: [...(a.comments ?? []), newComment] }
      )
    );

    setCommentFor(null);
    setCommentText("");
  }
  function renderCommentTree(a: Assignment, comments: Comment[], parentId: string | null = null, depth = 0) {
    const nodes = comments.filter((c) => (c.parentId ?? null) === parentId);
    if (!nodes.length) return null;

    return (
      <ul className={`space-y-3 ${depth > 0 ? "pl-4 border-l" : ""}`}>
        {nodes.map((c) => (
          <li key={c.id} className="flex items-start gap-3">
            <div className="mt-1">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{c.authorName}</span>
                <Badge variant="outline" className="capitalize">{c.authorRole}</Badge>
                <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-sm mt-1 whitespace-pre-wrap break-words">{c.content}</div>
              <div className="mt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => openCommentDialog(a.id, c.id)}
                >
                  <ReplyIcon className="h-3.5 w-3.5 mr-1" /> Reply
                </Button>
              </div>

              {renderCommentTree(a, comments, c.id, depth + 1)}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  const totalCount = items.length;
  const completedCount = items.filter((a) => a.status === "completed").length;
  const pendingCount = items.filter((a) => a.status === "pending").length;
  const overdueCount = items.filter((a) => a.status === "overdue").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {userRole === "parent" ? "Emma's Assignments" : "Class Assignments"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {userRole === "parent" ? "Upload your child's work, view grades, and chat with teachers" : "Manage, review, grade, and message parents"}
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>

          {userRole === "teacher" && (
            <Dialog
              open={isAssignDialogOpen}
              onOpenChange={(o) => {
                setAssignDialogOpen(o);
                if (!o) setEditingId(null); // reset edit mode when closing
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={openCreate} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  <span>New Assignment</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingId ? "Edit Assignment" : "Create New Assignment"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="assignment-title">Title</Label>
                    <Input id="assignment-title" value={draft.title ?? ""} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="assignment-subject">Subject</Label>
                    <Select
                      value={draft.subject ?? ""}
                      onValueChange={(value) => setDraft((d) => ({ ...d, subject: value as Subject }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Select subject" /></SelectTrigger>
                      <SelectContent>
                        {SUBJECTS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="assignment-description">Description</Label>
                    <Textarea id="assignment-description" value={draft.description ?? ""} onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} rows={3} />
                  </div>
                  <div>
                    <Label htmlFor="due-date">Due Date</Label>
                    <Input id="due-date" type="date" value={draft.dueDate ?? ""} onChange={(e) => setDraft((d) => ({ ...d, dueDate: e.target.value }))} />
                  </div>
                  <Button onClick={upsertAssignment} className="w-full">{editingId ? "Save Changes" : "Create Assignment"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Teacher stats */}
      {userRole === "teacher" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500"><CardContent className="p-4"><div className="flex items-center gap-3"><BookOpen className="h-8 w-8 text-blue-600"/><div><p className="text-2xl font-bold">{totalCount}</p><p className="text-sm text-muted-foreground">Total Assignments</p></div></div></CardContent></Card>
          <Card className="border-l-4 border-l-green-500"><CardContent className="p-4"><div className="flex items-center gap-3"><CheckCircle className="h-8 w-8 text-green-600"/><div><p className="text-2xl font-bold">{completedCount}</p><p className="text-sm text-muted-foreground">Completed</p></div></div></CardContent></Card>
          <Card className="border-l-4 border-l-amber-500"><CardContent className="p-4"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-amber-600"/><div><p className="text-2xl font-bold">{pendingCount}</p><p className="text-sm text-muted-foreground">Pending</p></div></div></CardContent></Card>
          <Card className="border-l-4 border-l-red-500"><CardContent className="p-4"><div className="flex items-center gap-3"><Clock className="h-8 w-8 text-red-600"/><div><p className="text-2xl font-bold">{overdueCount}</p><p className="text-sm text-muted-foreground">Overdue</p></div></div></CardContent></Card>
        </div>
      )}

      {/* Assignments List */}
      <div className="grid gap-4">
        {filtered.map((a) => (
          <Card key={a.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{a.title}</CardTitle>
                    <Badge className={`flex items-center gap-1 ${statusBadgeClasses(a.status)}`}>
                      {statusIcon(a.status)} <span className="capitalize">{a.status}</span>
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                    <Badge variant="outline">{a.subject}</Badge>
                    {userRole === "teacher" && a.completedBy != null && a.totalStudents != null && (
                      <span className="flex items-center gap-1"><Users className="h-4 w-4" />{a.completedBy}/{a.totalStudents} completed</span>
                    )}
                  </div>
                </div>

                {userRole === "teacher" && (
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" title="Preview"><Eye className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => openEdit(a)} title="Edit"><Edit className="h-4 w-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => deleteAssignment(a.id)} title="Delete"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{a.description}</p>

              {/* Parent: submit work */}
              {userRole === "parent" && (
                <Dialog open={submitForId === a.id} onOpenChange={(open) => (!open ? setSubmitForId(null) : openSubmitDialog(a.id))}>
                  <DialogTrigger asChild>
                    <Button className="w-full sm:w-auto" onClick={() => openSubmitDialog(a.id)}>
                      <UploadCloud className="h-4 w-4 mr-2" /> Submit Work
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Submit work: {a.title}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="submission-note">Note (optional)</Label>
                        <Textarea id="submission-note" rows={3} value={submitNote} onChange={(e) => setSubmitNote(e.target.value)} placeholder="Add a short note for the teacher..." />
                      </div>
                      <div>
                        <Label htmlFor="submission-files">Files (PDF or Images, up to 2 MB each, max 3)</Label>
                        <Input id="submission-files" type="file" multiple accept="application/pdf,image/*" onChange={onFilesSelected} />
                        {submitFiles.length > 0 && (
                          <ul className="mt-2 text-sm text-muted-foreground list-disc list-inside">
                            {submitFiles.map((f) => (<li key={f.name}>{f.name} — {bytesToHuman(f.size)}</li>))}
                          </ul>
                        )}
                      </div>
                      <Button onClick={handleSubmitFiles} className="w-full">Submit</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}

              {/* Submissions (both roles) */}
              {a.submissions && a.submissions.length > 0 && (
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium mb-2">Submissions</div>
                  <ul className="space-y-2">
                    {a.submissions.map((s) => (
                      <li key={s.id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm">
                            {s.fileName} <span className="text-muted-foreground">({bytesToHuman(s.size)})</span>
                          </div>
                          {s.note && <div className="text-xs text-muted-foreground mt-0.5">Note: {s.note}</div>}
                          <div className="text-xs text-muted-foreground">{new Date(s.submittedAt).toLocaleString()}</div>

                          {/* Grade display */}
                          {s.grade && (
                            <div className="mt-1 flex items-center gap-2">
                              <Badge className={gradeBadgeClasses(s.grade.value)}>{s.grade.value}</Badge>
                              {s.grade.feedback && (
                                <span className="text-xs text-muted-foreground">Feedback: {s.grade.feedback}</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <a className="inline-flex items-center text-sm underline decoration-dotted"
                             href={s.dataUrl} download={s.fileName} target="_blank" rel="noreferrer">
                            <Download className="h-4 w-4 mr-1" /> Download
                          </a>

                          {userRole === "teacher" && (
                            <Dialog open={gradeFor?.aId === a.id && gradeFor?.sId === s.id}
                                    onOpenChange={(open) => (!open ? setGradeFor(null) : openGradeDialog(a.id, s))}>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => openGradeDialog(a.id, s)}>
                                  <Pencil className="h-4 w-4 mr-1" /> {s.grade ? "Edit Grade" : "Grade"}
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-md">
                                <DialogHeader><DialogTitle>Grade submission</DialogTitle></DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label>Grade</Label>
                                    <Select value={gradeValue} onValueChange={(v) => setGradeValue(v as GradeValue)}>
                                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select grade" /></SelectTrigger>
                                      <SelectContent>
                                        {gradeOptions.map((opt) => (<SelectItem key={opt} value={opt}>{opt}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Feedback (optional)</Label>
                                    <Textarea rows={3} value={gradeFeedback} onChange={(e) => setGradeFeedback(e.target.value)} placeholder="Short note for the parent" />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button variant="secondary" onClick={() => setGradeFor(null)}>Cancel</Button>
                                    <Button onClick={saveGrade}>Save Grade</Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* COMMENTS & REPLIES */}
              <div className="rounded-md border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" /> Comments
                    <span className="text-xs text-muted-foreground">
                      {a.comments?.length ? `(${a.comments.length})` : "(0)"}
                    </span>
                  </div>
                  <Dialog open={commentFor?.aId === a.id && !commentFor?.parentId}
                          onOpenChange={(open) => (!open ? setCommentFor(null) : openCommentDialog(a.id, null))}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => openCommentDialog(a.id, null)}>
                        <Send className="h-3.5 w-3.5 mr-1" /> New Comment
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader><DialogTitle>New comment</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <Label htmlFor="cmt">Message</Label>
                        <Textarea id="cmt" rows={4} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write your message..." />
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => setCommentFor(null)}>Cancel</Button>
                          <Button onClick={saveComment}>Post</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Thread */}
                {a.comments && a.comments.length > 0 ? (
                  <div className="space-y-3">
                    {renderCommentTree(a, a.comments)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}

                {/* Reply dialog */}
                <Dialog open={Boolean(commentFor?.aId === a.id && commentFor?.parentId)}
                        onOpenChange={(open) => (!open ? setCommentFor(null) : undefined)}>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Reply</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Label htmlFor="replyText">Message</Label>
                      <Textarea id="replyText" rows={3} value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write your reply..." />
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setCommentFor(null)}>Cancel</Button>
                        <Button onClick={saveComment}><ReplyIcon className="h-4 w-4 mr-1" /> Reply</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Teacher progress (unchanged sample) */}
              {userRole === "teacher" && a.completedBy != null && a.totalStudents != null && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completion Progress</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round((a.completedBy / Math.max(1, a.totalStudents)) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(a.completedBy / Math.max(1, a.totalStudents)) * 100}%` }} />
                  </div>
                </div>
              )}

              {userRole === "parent" && a.status !== "completed" && (
                <Button className="w-full sm:w-auto" onClick={() => markComplete(a.id)}>
                  <CheckCircle className="h-4 w-4 mr-2" /> Mark as Complete
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No assignments found</h3>
            <p className="text-muted-foreground">
              {filterStatus === "all" ? "No assignments have been created yet." : `No ${filterStatus} assignments found.`}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
