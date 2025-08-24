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
  Search as SearchIcon, EyeOff, MessageSquare
} from "lucide-react";
import { User } from "@/lib/types";
import { ForumService, ForumPost, ForumComment, ForumTag } from "@/lib/services/forum";
import { useAuth } from "@/contexts/AuthContext";

interface ForumPageProps {
  userRole: User['role'];
  currentUserName?: string;
}

// ----- types
type SortKey = "hot" | "new" | "top";

const TAGS: ForumTag[] = ["general", "question", "advice", "event", "policy"];

const tagBadge = (t: ForumTag) => {
  switch (t) {
    case "question": return "bg-blue-100 text-blue-700";
    case "advice": return "bg-emerald-100 text-emerald-700";
    case "event": return "bg-violet-100 text-violet-700";
    case "policy": return "bg-red-100 text-red-700";
    default: return "bg-slate-100 text-slate-700";
  }
};

// ----- helpers
const fmt = (iso: string | Date) => {
  const d = iso instanceof Date ? iso : new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
};

// Simple "hot" score: upvotes / (hours + 2)^1.5 (pinned still comes first)
const hotness = (p: ForumPost) => {
  const hours = Math.max(0, (Date.now() - p.createdAt.getTime()) / 36e5);
  return (p.upvotes || 0) / Math.pow(hours + 2, 1.5);
};

export const ForumPage = ({ userRole, currentUserName }: ForumPageProps) => {
  const { user } = useAuth();
  const displayName = currentUserName || (userRole === "teacher" ? "Teacher" : userRole === "admin" ? "Admin" : "Parent");
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [comments, setComments] = useState<{ [postId: string]: ForumComment[] }>({});
  const [query, setQuery] = useState("");
  const [filterTag, setFilterTag] = useState<"all" | ForumTag>("all");
  const [sortKey, setSortKey] = useState<SortKey>("hot");
  const [loading, setLoading] = useState(true);
  const [expandedPosts, setExpandedPosts] = useState<Set<string>>(new Set());

  // Create/Edit post dialog
  const [isPostDialogOpen, setPostDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [postDraft, setPostDraft] = useState<Partial<ForumPost>>({
    title: "",
    body: "",
    tag: "general",
  });

  // Comment/reply dialog
  const [replyFor, setReplyFor] = useState<{ postId: string; parentId: string | null } | null>(null);
  const [replyText, setReplyText] = useState("");

  // 权限检查辅助函数
  const canDeletePost = (post: ForumPost) => {
    return userRole === "admin" || 
           userRole === "teacher" || 
           (userRole === post.authorRole && displayName === post.authorName);
  };

  const canDeleteComment = (comment: ForumComment) => {
    return userRole === "admin" || 
           userRole === "teacher" || 
           (userRole === comment.authorRole && displayName === comment.authorName);
  };

  const canModerateContent = () => {
    return userRole === "admin" || userRole === "teacher";
  };

  const canEditPost = (post: ForumPost) => {
    // 只有作者本人可以编辑帖子（或者管理员也可以编辑）
    return userRole === "admin" || (userRole === post.authorRole && displayName === post.authorName);
  };

  const canPinPost = () => {
    // 只有管理员和老师可以置顶帖子
    return userRole === "admin" || userRole === "teacher";
  };

  // Load/save
  useEffect(() => {
    const loadPosts = async () => {
      try {
        setLoading(true);
        const forumPosts = await ForumService.getPosts();
        setPosts(forumPosts);
      } catch (error) {
        console.error('Error loading forum posts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPosts();
  }, []);

  // Load comments for each post
  useEffect(() => {
    const loadCommentsForPosts = async () => {
      const commentsMap: { [postId: string]: ForumComment[] } = {};
      
      for (const post of posts) {
        try {
          const postComments = await ForumService.getPostComments(post.id);
          commentsMap[post.id] = postComments;
        } catch (error) {
          console.error(`Error loading comments for post ${post.id}:`, error);
          commentsMap[post.id] = [];
        }
      }
      
      setComments(commentsMap);
    };

    if (posts.length > 0) {
      loadCommentsForPosts();
    }
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
        return b.createdAt.getTime() - a.createdAt.getTime();
      }
      if (sortKey === "top") {
        return (b.upvotes || 0) - (a.upvotes || 0) ||
               b.createdAt.getTime() - a.createdAt.getTime();
      }
      return hotness(b) - hotness(a); // hot
    });

    return sorted;
  }, [posts, query, filterTag, sortKey]);

  // Voting
  async function togglePostUpvote(id: string) {
    if (!user) return;
    try {
      await ForumService.togglePostUpvote(id, user.uid);
      // Reload posts to get updated vote counts
      const updatedPosts = await ForumService.getPosts();
      setPosts(updatedPosts);
    } catch (error) {
      console.error('Error toggling post upvote:', error);
    }
  }

  async function toggleCommentUpvote(commentId: string) {
    if (!user) return;
    try {
      await ForumService.toggleCommentUpvote(commentId, user.uid);
      // Reload comments for all posts to get updated vote counts
      const commentsMap: { [postId: string]: ForumComment[] } = {};
      for (const post of posts) {
        const postComments = await ForumService.getPostComments(post.id);
        commentsMap[post.id] = postComments;
      }
      setComments(commentsMap);
    } catch (error) {
      console.error('Error toggling comment upvote:', error);
    }
  }

  // Post CRUD
  function openCreate() {
    setEditingId(null);
    setPostDraft({ title: "", body: "", tag: "general" });
    setPostDialogOpen(true);
  }
  
  function openEdit(p: ForumPost) {
    setEditingId(p.id);
    setPostDraft({ title: p.title, body: p.body, tag: p.tag });
    setPostDialogOpen(true);
  }
  
  async function upsertPost() {
    if (!postDraft.title || !postDraft.body || !postDraft.tag || !user) return;

    try {
      if (editingId) {
        // Update existing post
        await ForumService.updatePost(editingId, {
          title: postDraft.title!,
          body: postDraft.body!,
          tag: postDraft.tag as ForumTag
        });
      } else {
        // Create new post
        await ForumService.createPost({
          title: postDraft.title!,
          body: postDraft.body!,
          tag: postDraft.tag as ForumTag,
          authorRole: userRole,
          authorName: displayName,
          authorId: user.uid,
          isPinned: false
        });
      }
      
      // Reload posts
      const updatedPosts = await ForumService.getPosts();
      setPosts(updatedPosts);
      
      setEditingId(null);
      setPostDraft({ title: "", body: "", tag: "general" });
      setPostDialogOpen(false);
    } catch (error) {
      console.error('Error saving post:', error);
    }
  }
  
  async function removePost(id: string, authorRole: User['role'], authorName: string) {
    // 权限检查：管理员、老师、或作者本人可以删除帖子
    const canDelete = userRole === "admin" || 
                     userRole === "teacher" || 
                     (userRole === authorRole && displayName === authorName);
    
    if (!canDelete) return;
    if (!confirm("Delete this post?")) return;
    
    try {
      await ForumService.deletePost(id);
      // Reload posts
      const updatedPosts = await ForumService.getPosts();
      setPosts(updatedPosts);
    } catch (error) {
      console.error('Error deleting post:', error);
    }
  }
  
  async function togglePin(id: string) {
    if (!canPinPost()) return;
    
    try {
      const post = posts.find(p => p.id === id);
      if (post) {
        await ForumService.togglePin(id, !post.isPinned);
        // Reload posts
        const updatedPosts = await ForumService.getPosts();
        setPosts(updatedPosts);
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
  }

  // Comments
  function openReply(postId: string, parentId: string | null = null) {
    setReplyFor({ postId, parentId });
    setReplyText("");
  }
  
  async function saveReply() {
    if (!replyFor || !replyText.trim() || !user) return;
    
    try {
      await ForumService.addComment(replyFor.postId, {
        parentId: replyFor.parentId,
        body: replyText.trim(),
        authorRole: userRole,
        authorName: displayName,
        authorId: user.uid,
        hidden: false
      });
      
      // Reload comments for this specific post
      const postComments = await ForumService.getPostComments(replyFor.postId);
      setComments(prev => ({
        ...prev,
        [replyFor.postId]: postComments
      }));
      
      // Also reload posts to get updated comment count
      const updatedPosts = await ForumService.getPosts();
      setPosts(updatedPosts);
      
      setReplyFor(null);
      setReplyText("");
    } catch (error) {
      console.error('Error saving reply:', error);
    }
  }
  
  async function removeComment(postId: string, comment: ForumComment) {
    const canDelete = userRole === "admin" || 
                     userRole === "teacher" || 
                     (userRole === comment.authorRole && displayName === comment.authorName);
    
    if (!canDelete) return;
    if (!confirm("Delete this comment?")) return;
    
    try {
      await ForumService.deleteComment(comment.id, postId);
      
      // Reload comments for this post
      const postComments = await ForumService.getPostComments(postId);
      setComments(prev => ({
        ...prev,
        [postId]: postComments
      }));
      
      // Reload posts to get updated comment count
      const updatedPosts = await ForumService.getPosts();
      setPosts(updatedPosts);
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  }
  
  async function toggleCommentHidden(postId: string, commentId: string) {
    if (!canModerateContent() || !user) return;
    
    try {
      const postComments = comments[postId] || [];
      const comment = postComments.find(c => c.id === commentId);
      if (comment) {
        await ForumService.toggleCommentHidden(commentId, user.uid, !comment.hidden);
        
        // Reload comments for this post
        const updatedComments = await ForumService.getPostComments(postId);
        setComments(prev => ({
          ...prev,
          [postId]: updatedComments
        }));
      }
    } catch (error) {
      console.error('Error toggling comment hidden:', error);
    }
  }

  // Render comments with hide rules
  function renderCommentsTree(postId: string, parentId: string | null = null, depth = 0) {
    const postComments = comments[postId] || [];
    const nodes = postComments.filter(c => c.parentId === parentId);
    if (!nodes.length) return null;

    return (
      <ul className={`space-y-3 ${depth ? "pl-2 sm:pl-4 border-l" : ""}`}>
        {nodes.map(c => {
          const hidden = c.hidden === true;
          const hiddenForViewer = hidden && !canModerateContent();
          const hasUserUpvoted = user && c.upvotedBy.includes(user.uid);
          
          return (
            <li key={c.id} className="flex items-start gap-2 sm:gap-3">
              {/* votes (up only) */}
              <div className="flex flex-col items-center pt-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => !hiddenForViewer && toggleCommentUpvote(c.id)}
                  title="Upvote"
                  disabled={hiddenForViewer}
                >
                  <ArrowBigUp className={`h-4 w-4 ${hasUserUpvoted ? "text-emerald-600" : ""}`} />
                </Button>
                <div className="text-sm">{c.upvotes ?? 0}</div>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm">
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
                  <div className="text-xs sm:text-sm mt-1 whitespace-pre-wrap break-words">{c.body}</div>
                )}

                {/* actions */}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {!hiddenForViewer && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => openReply(postId, c.id)}
                    >
                      <ReplyIcon className="h-3.5 w-3.5 mr-1" /> Reply
                    </Button>
                  )}

                  {canDeleteComment(c) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-red-600"
                      onClick={() => removeComment(postId, c)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                    </Button>
                  )}

                  {canModerateContent() && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => toggleCommentHidden(postId, c.id)}
                    >
                      <EyeOff className="h-3.5 w-3.5 mr-1" />
                      {hidden ? "Unhide" : "Hide"}
                    </Button>
                  )}
                </div>

                {/* children: if hidden for this viewer, don't render subtree */}
                {!hiddenForViewer && renderCommentsTree(postId, c.id, depth + 1)}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">Forum</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Start topics, ask questions, and share advice.</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 sm:gap-4">
            <SearchIcon className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search posts..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 sm:w-64 mobile-input"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Select value={filterTag} onValueChange={(v) => setFilterTag(v as "all" | ForumTag)}>
              <SelectTrigger className="w-full sm:w-32 mobile-input">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {TAGS.map(t => <SelectItem key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-full sm:w-32 mobile-input">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="top">Top</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (expandedPosts.size === filtered.length) {
                  setExpandedPosts(new Set());
                } else {
                  setExpandedPosts(new Set(filtered.map(p => p.id)));
                }
              }}
              className="text-xs h-10"
            >
              {expandedPosts.size === filtered.length ? "Collapse All" : "Expand All"}
            </Button>
          </div>

          <Dialog open={isPostDialogOpen} onOpenChange={(o) => { setPostDialogOpen(o); if (!o) setEditingId(null); }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate} className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 w-full sm:w-auto h-10">
                <MessageSquare className="h-4 w-4" />
                New Post
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md mobile-modal">
              <DialogHeader className="mobile-modal-header">
                <DialogTitle>{editingId ? "Edit Post" : "Create New Post"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mobile-modal-content">
                <div>
                  <Label htmlFor="post-title">Title</Label>
                  <Input id="post-title" value={postDraft.title ?? ""} onChange={(e) => setPostDraft(d => ({ ...d, title: e.target.value }))} className="mobile-input" />
                </div>
                <div>
                  <Label htmlFor="post-tag">Tag</Label>
                  <Select value={(postDraft.tag as ForumTag) ?? "general"} onValueChange={(v) => setPostDraft(d => ({ ...d, tag: v as ForumTag }))}>
                    <SelectTrigger className="mobile-input"><SelectValue placeholder="Select tag" /></SelectTrigger>
                    <SelectContent>
                      {TAGS.map(t => <SelectItem key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="post-body">Body</Label>
                  <Textarea id="post-body" rows={5} value={postDraft.body ?? ""} onChange={(e) => setPostDraft(d => ({ ...d, body: e.target.value }))} className="mobile-textarea" />
                </div>
                <Button className="w-full touch-button bg-green-600 hover:bg-green-700 text-white" onClick={upsertPost}>{editingId ? "Save Changes" : "Post"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex justify-center items-center py-8 sm:py-12">
          <div className="text-muted-foreground">Loading forum posts...</div>
        </div>
      ) : (
        <>
          {/* Posts */}
          <div className="space-y-3 sm:space-y-4">
            {filtered.map(p => {
              const isExpanded = expandedPosts.has(p.id);
              return (
                <Card
                  key={p.id}
                  className={`hover:shadow-lg transition-shadow ${p.isPinned ? "border-l-4 border-l-amber-500" : ""}`}
                >
                  <CardHeader className="p-3 sm:p-4">
                    <div className="flex items-start gap-3 sm:gap-4">
                      {/* vote column (up only) */}
                      <div className="flex flex-col items-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => togglePostUpvote(p.id)}
                          title="Upvote"
                        >
                          <ArrowBigUp className={`h-5 w-5 ${user && p.upvotedBy.includes(user.uid) ? "text-emerald-600" : ""}`} />
                        </Button>
                        <div className="text-sm">{p.upvotes ?? 0}</div>
                      </div>

                      {/* content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {p.isPinned && <Pin className="h-4 w-4 text-amber-600" />}
                              <CardTitle className="text-base sm:text-lg">{p.title}</CardTitle>
                              <Badge className={tagBadge(p.tag)}>{p.tag}</Badge>
                            </div>
                            <div className="text-xs sm:text-sm text-muted-foreground">
                              Posted by <span className="font-medium">{p.authorName}</span> • {fmt(p.createdAt)}
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MessageCircle className="h-4 w-4" /> {comments[p.id]?.length || 0} comments
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newExpanded = new Set(expandedPosts);
                                  if (isExpanded) {
                                    newExpanded.delete(p.id);
                                  } else {
                                    newExpanded.add(p.id);
                                  }
                                  setExpandedPosts(newExpanded);
                                }}
                                className="h-auto p-1 text-xs hover:bg-muted/50"
                              >
                                {isExpanded ? (
                                  <span className="flex items-center gap-1">
                                    <EyeOff className="h-3 w-3" /> <span className="hidden sm:inline">Hide Comments</span><span className="sm:hidden">Hide</span>
                                  </span>
                                ) : (
                                  <span className="flex items-center gap-1">
                                    <MessageCircle className="h-3 w-3" /> <span className="hidden sm:inline">Show Comments</span><span className="sm:hidden">Show</span>
                                  </span>
                                )}
                              </Button>
                            </div>
                          </div>

                          {/* actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {canPinPost() && (
                              <Button size="sm" variant="outline" title={p.isPinned ? "Unpin" : "Pin"} onClick={() => togglePin(p.id)} className="h-8 w-8 p-0">
                                <Pin className="h-4 w-4" />
                              </Button>
                            )}
                            {canEditPost(p) && (
                              <Button size="sm" variant="outline" title="Edit" onClick={() => openEdit(p)} className="h-8 w-8 p-0">
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canDeletePost(p) && (
                              <Button size="sm" variant="outline" title="Delete" onClick={() => removePost(p.id, p.authorRole, p.authorName)} className="h-8 w-8 p-0">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Show post body and comments only when expanded */}
                  {isExpanded && (
                    <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-4 pt-0">
                      <div className="whitespace-pre-wrap">{p.body}</div>

                      {/* New top-level comment */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <MessageCircle className="h-4 w-4" /> {comments[p.id]?.length || 0} comments
                        </div>
                        <Dialog open={Boolean(replyFor?.postId === p.id && replyFor?.parentId === null)}
                                onOpenChange={(o) => (!o ? setReplyFor(null) : openReply(p.id, null))}>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => openReply(p.id, null)} className="w-full sm:w-auto h-10">
                              Add Comment
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md mobile-modal">
                            <DialogHeader className="mobile-modal-header"><DialogTitle>New comment</DialogTitle></DialogHeader>
                            <div className="space-y-3 mobile-modal-content">
                              <Textarea rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write your comment..." className="mobile-textarea" />
                              <div className="flex flex-col sm:flex-row justify-end gap-2">
                                <Button variant="secondary" onClick={() => setReplyFor(null)} className="w-full sm:w-auto touch-button">Cancel</Button>
                                <Button onClick={saveReply} className="w-full sm:w-auto touch-button">Post</Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>

                      {/* Thread */}
                      {comments[p.id] && comments[p.id].length > 0 ? (
                        <div className="space-y-3">
                          {renderCommentsTree(p.id)}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No comments yet.</p>
                      )}

                      {/* Reply dialog for nested replies */}
                      <Dialog open={Boolean(replyFor?.postId === p.id && replyFor?.parentId)}
                              onOpenChange={(o) => (!o ? setReplyFor(null) : undefined)}>
                        <DialogContent className="max-w-md mobile-modal">
                          <DialogHeader className="mobile-modal-header"><DialogTitle>Reply</DialogTitle></DialogHeader>
                          <div className="space-y-3 mobile-modal-content">
                            <Textarea rows={3} value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write your reply..." className="mobile-textarea" />
                            <div className="flex flex-col sm:flex-row justify-end gap-2">
                              <Button variant="secondary" onClick={() => setReplyFor(null)} className="w-full sm:w-auto touch-button">Cancel</Button>
                              <Button onClick={saveReply} className="w-full sm:w-auto touch-button"><ReplyIcon className="h-4 w-4 mr-1" /> Reply</Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <Card>
              <CardContent className="p-6 sm:p-12 text-center">
                <MessageCircle className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mx-auto mb-3 sm:mb-4" />
                <h3 className="text-base sm:text-lg font-medium text-foreground mb-2">No posts yet</h3>
                <p className="text-sm sm:text-base text-muted-foreground">Be the first to start a discussion.</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
};