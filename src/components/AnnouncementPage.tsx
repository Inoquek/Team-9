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
  Plus, Pin, Edit, Trash2, MessageCircle, ArrowBigUp, Reply as ReplyIcon,
  Search as SearchIcon, EyeOff
} from "lucide-react";

interface ForumPageProps {
  userRole: "parent" | "teacher";
  currentUserName?: string;
}

// ----- types
type Tag = "general" | "question" | "advice" | "event" | "policy";
type SortKey = "hot" | "new" | "top";

type Comment = {
  id: string;
  parentId: string | null;
  body: string;
  authorRole: "parent" | "teacher";
  authorName: string;
  createdAt: string; // ISO
  upvotes: number;      // ✅ upvotes only
  userUpvoted?: boolean; // persisted per-browser demo
  hidden?: boolean;     // ✅ teacher can hide/unhide
};

type Post = {
  id: string;
  title: string;
  body: string;
  tag: Tag;
  authorRole: "parent" | "teacher";
  authorName: string;
  createdAt: string; // ISO
  isPinned: boolean;
  upvotes: number;        // ✅ upvotes only
  userUpvoted?: boolean;  // persisted per-browser demo
  comments: Comment[];
};

const STORAGE_KEY = "forum_posts_v1";
const TAGS: Tag[] = ["general", "question", "advice", "event", "policy"];
const tagBadge = (t: Tag) => {
  switch (t) {
    case "question": return "bg-blue-100 text-blue-700";
    case "advice": return "bg-emerald-100 text-emerald-700";
    case "event": return "bg-violet-100 text-violet-700";
    case "policy": return "bg-red-100 text-red-700";
    default: return "bg-slate-100 text-slate-700";
  }
};

// ----- helpers
const nowISO = () => new Date().toISOString();
const fmt = (iso: string) => {
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
};

// Simple “hot” score: upvotes / (hours + 2)^1.5 (pinned still comes first)
const hotness = (p: Post) => {
  const hours = Math.max(0, (Date.now() - new Date(p.createdAt).getTime()) / 36e5);
  return (p.upvotes || 0) / Math.pow(hours + 2, 1.5);
};

// seed data in the new shape
const seed = (role: "parent" | "teacher", name?: string): Post[] => [
  {
    id: "p1",
    title: "How do you practice alphabet recognition at home?",
    body: "Looking for fun, low-prep ideas. What worked for your kids?",
    tag: "question",
    authorRole: "parent",
    authorName: "Parent A",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    isPinned: true,
    upvotes: 5,
    userUpvoted: false,
    comments: [
      {
        id: "c1",
        parentId: null,
        body: "We play a fridge-magnet scavenger hunt. Works great!",
        authorRole: "parent",
        authorName: "Parent B",
        createdAt: nowISO(),
        upvotes: 3,
        userUpvoted: false,
        hidden: false,
      },
      {
        id: "c2",
        parentId: "c1",
        body: "Love this idea—thanks for sharing!",
        authorRole: "teacher",
        authorName: "Ms. Bee",
        createdAt: nowISO(),
        upvotes: 2,
        userUpvoted: false,
        hidden: false,
      },
    ],
  },
  {
    id: "p2",
    title: "Reminder: Show & Tell next Friday",
    body: "Theme is 'My Favorite Book'. Short share, 1–2 minutes per kid.",
    tag: "event",
    authorRole: "teacher",
    authorName: "Ms. Bee",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    isPinned: false,
    upvotes: 2,
    userUpvoted: false,
    comments: [],
  },
  {
    id: "p3",
    title: "Screen-time policy for rainy days?",
    body: "What’s a reasonable guideline for 4–5 year olds on days we’re inside a lot?",
    tag: "policy",
    authorRole: role,
    authorName: name || (role === "teacher" ? "Teacher" : "Parent"),
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    isPinned: false,
    upvotes: 1,
    userUpvoted: false,
    comments: [],
  },
];

// ---- migration from old score/userVote to upvotes/userUpvoted
function migrate(raw: any): Post[] {
  const posts = Array.isArray(raw) ? raw : [];
  return posts.map((p: any) => {
    const upvotes = typeof p.upvotes === "number" ? p.upvotes : Math.max(0, Number(p.score) || 0);
    const userUpvoted = typeof p.userUpvoted === "boolean" ? p.userUpvoted : p.userVote === 1;
    const comments: Comment[] = (p.comments || []).map((c: any) => ({
      id: c.id,
      parentId: c.parentId ?? null,
      body: c.body ?? "",
      authorRole: c.authorRole === "teacher" ? "teacher" : "parent",
      authorName: c.authorName ?? "User",
      createdAt: c.createdAt ?? nowISO(),
      upvotes: typeof c.upvotes === "number" ? c.upvotes : Math.max(0, Number(c.score) || 0),
      userUpvoted: typeof c.userUpvoted === "boolean" ? c.userUpvoted : c.userVote === 1,
      hidden: Boolean(c.hidden) || false,
    }));
    return {
      id: p.id,
      title: p.title ?? "",
      body: p.body ?? "",
      tag: (p.tag as Tag) ?? "general",
      authorRole: p.authorRole === "teacher" ? "teacher" : "parent",
      authorName: p.authorName ?? "User",
      createdAt: p.createdAt ?? nowISO(),
      isPinned: Boolean(p.isPinned),
      upvotes,
      userUpvoted,
      comments,
    } as Post;
  });
}

export const AnnouncementPage = ({ userRole, currentUserName }: ForumPageProps) => {
  const displayName = currentUserName || (userRole === "teacher" ? "Teacher" : "Parent");
  const [posts, setPosts] = useState<Post[]>([]);
  const [query, setQuery] = useState("");
  const [filterTag, setFilterTag] = useState<"all" | Tag>("all");
  const [sortKey, setSortKey] = useState<SortKey>("hot");

  // Create/Edit post dialog
  const [isPostDialogOpen, setPostDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [postDraft, setPostDraft] = useState<Partial<Post>>({
    title: "",
    body: "",
    tag: "general",
  });

  // Comment/reply dialog
  const [replyFor, setReplyFor] = useState<{ postId: string; parentId: string | null } | null>(null);
  const [replyText, setReplyText] = useState("");

  // Load/save
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setPosts(migrate(parsed));
        return;
      } catch { /* ignore */ }
    }
    setPosts(seed(userRole, displayName));
  }, [userRole, displayName]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  }, [posts]);

  // Derived
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const visible = posts
      .filter(p => (filterTag === "all" ? true : p.tag === filterTag))
      .filter(p => (q ? p.title.toLowerCase().includes(q) || p.body.toLowerCase().includes(q) : true));

    const sorted = [...visible].sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1; // pinned first
      if (sortKey === "new") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortKey === "top") {
        return (b.upvotes || 0) - (a.upvotes || 0) ||
               new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      return hotness(b) - hotness(a); // hot
    });

    return sorted;
  }, [posts, query, filterTag, sortKey]);

  // Voting
  function togglePostUpvote(id: string) {
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        const nextUp = p.userUpvoted ? (p.upvotes || 0) - 1 : (p.upvotes || 0) + 1;
        return { ...p, upvotes: Math.max(0, nextUp), userUpvoted: !p.userUpvoted };
      })
    );
  }
  function toggleCommentUpvote(postId: string, commentId: string) {
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const comments = p.comments.map(c => {
          if (c.id !== commentId) return c;
          const nextUp = c.userUpvoted ? (c.upvotes || 0) - 1 : (c.upvotes || 0) + 1;
          return { ...c, upvotes: Math.max(0, nextUp), userUpvoted: !c.userUpvoted };
        });
        return { ...p, comments };
      })
    );
  }

  // Post CRUD
  function openCreate() {
    setEditingId(null);
    setPostDraft({ title: "", body: "", tag: "general" });
    setPostDialogOpen(true);
  }
  function openEdit(p: Post) {
    setEditingId(p.id);
    setPostDraft({ title: p.title, body: p.body, tag: p.tag });
    setPostDialogOpen(true);
  }
  function upsertPost() {
    if (!postDraft.title || !postDraft.body || !postDraft.tag) return;

    if (editingId) {
      setPosts(prev =>
        prev.map(p =>
          p.id === editingId
            ? { ...p, title: postDraft.title!, body: postDraft.body!, tag: postDraft.tag as Tag }
            : p
        )
      );
    } else {
      const id = (crypto as any)?.randomUUID?.() ?? Math.random().toString(36).slice(2);
      const newPost: Post = {
        id,
        title: postDraft.title!,
        body: postDraft.body!,
        tag: postDraft.tag as Tag,
        authorRole: userRole,
        authorName: displayName,
        createdAt: nowISO(),
        isPinned: false,
        upvotes: 0,
        userUpvoted: false,
        comments: [],
      };
      setPosts(prev => [newPost, ...prev]);
    }
    setEditingId(null);
    setPostDraft({ title: "", body: "", tag: "general" });
    setPostDialogOpen(false);
  }
  function removePost(id: string, authorRole: "parent" | "teacher", authorName: string) {
    // Teachers can delete any. Parents can delete their own only (demo rule).
    if (userRole !== "teacher" && !(userRole === authorRole && displayName === authorName)) return;
    if (!confirm("Delete this post?")) return;
    setPosts(prev => prev.filter(p => p.id !== id));
  }
  function togglePin(id: string) {
    if (userRole !== "teacher") return;
    setPosts(prev => prev.map(p => (p.id === id ? { ...p, isPinned: !p.isPinned } : p)));
  }

  // Comments
  function openReply(postId: string, parentId: string | null = null) {
    setReplyFor({ postId, parentId });
    setReplyText("");
  }
  function saveReply() {
    if (!replyFor || !replyText.trim()) return;
    const id = (crypto as any)?.randomUUID?.() ?? Math.random().toString(36).slice(2);
    const newComment: Comment = {
      id,
      parentId: replyFor.parentId,
      body: replyText.trim(),
      authorRole: userRole,
      authorName: displayName,
      createdAt: nowISO(),
      upvotes: 0,
      userUpvoted: false,
      hidden: false,
    };
    setPosts(prev =>
      prev.map(p => (p.id === replyFor.postId ? { ...p, comments: [...p.comments, newComment] } : p))
    );
    setReplyFor(null);
    setReplyText("");
  }
  function removeComment(postId: string, comment: Comment) {
    if (userRole !== "teacher" && !(userRole === comment.authorRole && displayName === comment.authorName)) return;
    if (!confirm("Delete this comment?")) return;
    // Remove comment and all its descendants
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const delSet = new Set<string>([comment.id]);
        let changed = true;
        while (changed) {
          changed = false;
          p.comments.forEach(c => {
            if (c.parentId && delSet.has(c.parentId) && !delSet.has(c.id)) {
              delSet.add(c.id);
              changed = true;
            }
          });
        }
        return { ...p, comments: p.comments.filter(c => !delSet.has(c.id)) };
      })
    );
  }
  function toggleCommentHidden(postId: string, commentId: string) {
    if (userRole !== "teacher") return;
    setPosts(prev =>
      prev.map(p => {
        if (p.id !== postId) return p;
        const comments = p.comments.map(c =>
          c.id === commentId ? { ...c, hidden: !c.hidden } : c
        );
        return { ...p, comments };
      })
    );
  }

  // Render comments with hide rules
  function renderCommentsTree(p: Post, parentId: string | null = null, depth = 0) {
    const nodes = p.comments.filter(c => c.parentId === parentId);
    if (!nodes.length) return null;

    return (
      <ul className={`space-y-3 ${depth ? "pl-4 border-l" : ""}`}>
        {nodes.map(c => {
          const hidden = c.hidden === true;
          const hiddenForViewer = hidden && userRole !== "teacher";
          return (
            <li key={c.id} className="flex items-start gap-3">
              {/* votes (up only) */}
              <div className="flex flex-col items-center pt-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => !hiddenForViewer && toggleCommentUpvote(p.id, c.id)}
                  title="Upvote"
                  disabled={hiddenForViewer}
                >
                  <ArrowBigUp className={`h-4 w-4 ${c.userUpvoted ? "text-emerald-600" : ""}`} />
                </Button>
                <div className="text-sm">{c.upvotes ?? 0}</div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{c.authorName}</span>
                  <Badge variant="outline" className="capitalize">{c.authorRole}</Badge>
                  {hidden && <Badge variant="destructive">Hidden</Badge>}
                  <span className="text-xs text-muted-foreground">{fmt(c.createdAt)}</span>
                </div>

                {/* body or placeholder */}
                {hiddenForViewer ? (
                  <div className="text-xs text-muted-foreground italic mt-1">
                    This comment has been hidden by a teacher.
                  </div>
                ) : (
                  <div className="text-sm mt-1 whitespace-pre-wrap break-words">{c.body}</div>
                )}

                {/* actions */}
                <div className="mt-2 flex items-center gap-2">
                  {!hiddenForViewer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => openReply(p.id, c.id)}
                    >
                      <ReplyIcon className="h-3.5 w-3.5 mr-1" /> Reply
                    </Button>
                  )}

                  {(userRole === "teacher" || (displayName === c.authorName && userRole === c.authorRole)) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-600"
                      onClick={() => removeComment(p.id, c)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  )}

                  {userRole === "teacher" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleCommentHidden(p.id, c.id)}
                    >
                      <EyeOff className="h-3.5 w-3.5 mr-1" />
                      {hidden ? "Unhide" : "Hide"}
                    </Button>
                  )}
                </div>

                {/* children: if hidden for this viewer, don't render subtree */}
                {!hiddenForViewer && renderCommentsTree(p, c.id, depth + 1)}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Forum</h1>
          <p className="text-muted-foreground mt-1">Start topics, ask questions, and share advice.</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Input
              className="pl-9"
              placeholder="Search posts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>

          <Select value={filterTag} onValueChange={(v) => setFilterTag(v as any)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {TAGS.map(t => <SelectItem key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hot">Hot</SelectItem>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="top">Top</SelectItem>
            </SelectContent>
          </Select>

          {/* New Post */}
          <Dialog open={isPostDialogOpen} onOpenChange={(o) => { setPostDialogOpen(o); if (!o) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="flex items-center gap-2">
                <Plus className="h-4 w-4" /> New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit Post" : "Create New Post"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="post-title">Title</Label>
                  <Input id="post-title" value={postDraft.title ?? ""} onChange={(e) => setPostDraft(d => ({ ...d, title: e.target.value }))} />
                </div>
                <div>
                  <Label htmlFor="post-tag">Tag</Label>
                  <Select value={(postDraft.tag as Tag) ?? "general"} onValueChange={(v) => setPostDraft(d => ({ ...d, tag: v as Tag }))}>
                    <SelectTrigger><SelectValue placeholder="Select tag" /></SelectTrigger>
                    <SelectContent>
                      {TAGS.map(t => <SelectItem key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="post-body">Body</Label>
                  <Textarea id="post-body" rows={5} value={postDraft.body ?? ""} onChange={(e) => setPostDraft(d => ({ ...d, body: e.target.value }))} />
                </div>
                <Button className="w-full" onClick={upsertPost}>{editingId ? "Save Changes" : "Post"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Posts */}
      <div className="space-y-4">
        {filtered.map(p => {
          const canEdit = displayName === p.authorName && userRole === p.authorRole;
          const canDelete = userRole === "teacher" || canEdit;

          return (
            <Card
              key={p.id}
              className={`hover:shadow-lg transition-shadow ${p.isPinned ? "border-l-4 border-l-amber-500" : ""}`}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  {/* vote column (up only) */}
                  <div className="flex flex-col items-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => togglePostUpvote(p.id)}
                      title="Upvote"
                    >
                      <ArrowBigUp className={`h-5 w-5 ${p.userUpvoted ? "text-emerald-600" : ""}`} />
                    </Button>
                    <div className="text-sm">{p.upvotes ?? 0}</div>
                  </div>

                  {/* content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {p.isPinned && <Pin className="h-4 w-4 text-amber-600" />}
                          <CardTitle className="text-lg">{p.title}</CardTitle>
                          <Badge className={tagBadge(p.tag)}>{p.tag}</Badge>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Posted by <span className="font-medium">{p.authorName}</span> • {fmt(p.createdAt)}
                        </div>
                      </div>

                      {/* actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        {userRole === "teacher" && (
                          <Button size="sm" variant="outline" title={p.isPinned ? "Unpin" : "Pin"} onClick={() => togglePin(p.id)}>
                            <Pin className="h-4 w-4" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button size="sm" variant="outline" title="Edit" onClick={() => openEdit(p)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button size="sm" variant="outline" title="Delete" onClick={() => removePost(p.id, p.authorRole, p.authorName)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="whitespace-pre-wrap">{p.body}</div>

                {/* New top-level comment */}
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium flex items-center gap-2">
                    <MessageCircle className="h-4 w-4" /> {p.comments.length} comments
                  </div>
                  <Dialog open={Boolean(replyFor?.postId === p.id && replyFor?.parentId === null)}
                          onOpenChange={(o) => (!o ? setReplyFor(null) : openReply(p.id, null))}>
                    <DialogTrigger asChild>
                      <Button size="sm" variant="outline" onClick={() => openReply(p.id, null)}>
                        Add Comment
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader><DialogTitle>New comment</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <Textarea rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write your comment..." />
                        <div className="flex justify-end gap-2">
                          <Button variant="secondary" onClick={() => setReplyFor(null)}>Cancel</Button>
                          <Button onClick={saveReply}>Post</Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Thread */}
                {p.comments.length > 0 ? (
                  <div className="space-y-3">
                    {renderCommentsTree(p)}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}

                {/* Reply dialog for nested replies */}
                <Dialog open={Boolean(replyFor?.postId === p.id && replyFor?.parentId)}
                        onOpenChange={(o) => (!o ? setReplyFor(null) : undefined)}>
                  <DialogContent className="max-w-md">
                    <DialogHeader><DialogTitle>Reply</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <Textarea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write your reply..." />
                      <div className="flex justify-end gap-2">
                        <Button variant="secondary" onClick={() => setReplyFor(null)}>Cancel</Button>
                        <Button onClick={saveReply}><ReplyIcon className="h-4 w-4 mr-1" /> Reply</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No posts yet</h3>
            <p className="text-muted-foreground">Be the first to start a discussion.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
