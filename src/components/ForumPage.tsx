import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useTeacherClass } from "@/contexts/TeacherClassContext";
import { ForumService, ForumPost, ForumComment } from "@/lib/services/forum";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Plus, Pin, Edit, Trash2, MessageCircle, ArrowBigUp, Reply as ReplyIcon,
  Search as SearchIcon, EyeOff, Users, Calendar, TrendingUp
} from "lucide-react";

interface ForumPageProps {
  userRole: "parent" | "teacher" | "admin";
}

type Tag = "general" | "question" | "advice" | "event" | "policy";
type SortKey = "hot" | "new" | "top";

export const ForumPage = ({ userRole }: ForumPageProps) => {
  const { user } = useAuth();
  const { selectedClass } = useTeacherClass();
  const { toast } = useToast();
  
  // Debug: Log the actual user object and role
  console.log('ForumPage rendered with:', {
    user: user,
    userRole: userRole,
    userRoleFromUser: user?.role,
    selectedClass: selectedClass
  });
  
  // State management
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<Tag | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("hot");
  
  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isReplyDialogOpen, setIsReplyDialogOpen] = useState(false);
  
  // Form states
  const [postForm, setPostForm] = useState({
    title: "",
    body: "",
    tag: "general" as Tag,
    classId: ""
  });
  
  const [editForm, setEditForm] = useState({
    id: "",
    title: "",
    body: "",
    tag: "general" as Tag,
    classId: ""
  });
  
  const [replyForm, setReplyForm] = useState({
    postId: "",
    parentId: null as string | null,
    body: ""
  });
  
  const [editingPost, setEditingPost] = useState<ForumPost | null>(null);
  const [replyingTo, setReplyingTo] = useState<{ postId: string; parentId: string | null; authorName: string } | null>(null);

  // Load forum posts
  useEffect(() => {
    const loadPosts = async () => {
      if (!user) return;
      
      console.log('Loading forum posts...', { user, userRole, selectedClass, selectedTag, sortBy });
      setIsLoading(true);
      try {
        const options: any = {
          limit: 50
        };
        
        // Filter by class if teacher has selected one
        if (userRole === "teacher" && selectedClass) {
          options.classId = selectedClass.id;
        }
        
        // Filter by tag
        if (selectedTag !== "all") {
          options.tag = selectedTag;
        }
        
        console.log('ForumService options:', options);
        const forumPosts = await ForumService.getForumPosts(options);
        console.log('Loaded forum posts:', forumPosts);
        
        // Sort posts based on selected sort
        let sortedPosts = [...forumPosts];
        switch (sortBy) {
          case "hot":
            sortedPosts.sort((a, b) => {
              const aScore = a.upvotes + (a.comments.length * 2);
              const bScore = b.upvotes + (b.comments.length * 2);
              return bScore - aScore;
            });
            break;
          case "new":
            sortedPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            break;
          case "top":
            sortedPosts.sort((a, b) => b.upvotes - a.upvotes);
            break;
        }
        
        console.log('Setting posts state:', sortedPosts);
        setPosts(sortedPosts);
      } catch (error) {
        console.error('Error loading forum posts:', error);
        // Set empty posts array on error to prevent undefined issues
        setPosts([]);
        toast({
          title: "Forum Loading Error",
          description: "Failed to load forum posts. This might be because the forum is new and has no posts yet. Try creating the first post!",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPosts();
  }, [user, userRole, selectedClass, selectedTag, sortBy, toast]);

  // Test function to create a sample post
  const createTestPost = async () => {
    if (!user) return;
    
    console.log('Creating test post with user:', {
      uid: user.uid,
      displayName: user.displayName,
      username: user.username,
      userRole: userRole,
      selectedClass: selectedClass
    });

    // Debug: Check if user document exists in Firestore
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      console.log('User document in Firestore:', userDoc.exists() ? userDoc.data() : 'Document does not exist');
    } catch (error) {
      console.error('Error reading user document:', error);
    }
    
    try {
      const testPostData: any = {
        title: "Welcome to the Community Forum! 🎉",
        body: "This is the first post in our new community forum. Parents and teachers can use this space to:\n\n• Ask questions about early childhood education\n• Share tips and advice\n• Discuss classroom activities and events\n• Connect with other families\n• Get support from the community\n\nFeel free to create your own posts and start conversations!",
        tag: "general" as Tag,
        authorRole: userRole as "parent" | "teacher",
        authorId: user.uid,
        authorName: user.displayName || user.username,
        isPinned: true
      };

      // Only add classId if it's defined
      if (userRole === "teacher" && selectedClass?.id) {
        testPostData.classId = selectedClass.id;
      }

      console.log('Test post data:', testPostData);
      const postId = await ForumService.createPost(testPostData);
      console.log('Test post created with ID:', postId);
      
      toast({
        title: "Test Post Created!",
        description: "A welcome post has been created. Refresh the page to see it.",
      });
      
      // Reload posts by triggering the useEffect
      setIsLoading(true);
      // The useEffect will automatically reload posts
    } catch (error) {
      console.error('Error creating test post:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create test post.",
        variant: "destructive"
      });
    }
  };

  // Real-time updates subscription
  useEffect(() => {
    if (!user) return;

    const unsubscribe = ForumService.subscribeToForumPosts((updatedPosts) => {
      setPosts(updatedPosts);
    }, {
      classId: userRole === "teacher" && selectedClass ? selectedClass.id : undefined,
      tag: selectedTag !== "all" ? selectedTag : undefined
    });

    return () => unsubscribe();
  }, [user, userRole, selectedClass, selectedTag]);

  // Handle post creation
  const handleCreatePost = async () => {
    if (!user || !postForm.title.trim() || !postForm.body.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
        return;
    }

    try {
      const postData: any = {
        title: postForm.title.trim(),
        body: postForm.body.trim(),
        tag: postForm.tag,
        authorRole: userRole as "parent" | "teacher",
        authorId: user.uid,
        authorName: user.displayName || user.username,
        isPinned: false
      };

      // Only add classId if it's defined and not empty
      if (postForm.classId && postForm.classId.trim() !== "") {
        postData.classId = postForm.classId.trim();
      }

      await ForumService.createPost(postData);
      
      toast({
        title: "Post Created!",
        description: "Your forum post has been published successfully.",
      });

      // Reset form and close dialog
      setPostForm({ title: "", body: "", tag: "general", classId: "" });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle post editing
  const handleEditPost = async () => {
    if (!editingPost || !editForm.title.trim() || !editForm.body.trim()) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    try {
      await ForumService.updatePost(editingPost.id, {
        title: editForm.title.trim(),
        body: editForm.body.trim(),
        tag: editForm.tag,
        classId: editForm.classId || undefined,
        updatedAt: new Date()
      });

      toast({
        title: "Post Updated!",
        description: "Your forum post has been updated successfully.",
      });

      // Reset form and close dialog
      setEditForm({ id: "", title: "", body: "", tag: "general", classId: "" });
      setEditingPost(null);
      setIsEditDialogOpen(false);
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: "Error",
        description: "Failed to update post. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle post deletion
  const handleDeletePost = async (post: ForumPost) => {
    if (!user || (post.authorId !== user.uid && userRole !== "admin")) {
      toast({
        title: "Permission Denied",
        description: "You can only delete your own posts.",
        variant: "destructive"
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete "${post.title}"? This action cannot be undone.`)) {
      try {
        await ForumService.deletePost(post.id);
        toast({
          title: "Post Deleted",
          description: "The forum post has been deleted successfully.",
        });
      } catch (error) {
        console.error('Error deleting post:', error);
        toast({
          title: "Error",
          description: "Failed to delete post. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  // Handle post pinning/unpinning (admin/teacher only)
  const handleTogglePin = async (post: ForumPost) => {
    if (!user || (userRole !== "admin" && userRole !== "teacher")) {
      toast({
        title: "Permission Denied",
        description: "Only teachers and admins can pin posts.",
        variant: "destructive"
      });
      return;
    }

    try {
      await ForumService.togglePostPin(post.id, !post.isPinned);
      toast({
        title: post.isPinned ? "Post Unpinned" : "Post Pinned",
        description: `Post "${post.title}" has been ${post.isPinned ? "unpinned" : "pinned"}.`,
      });
    } catch (error) {
      console.error('Error toggling post pin:', error);
      toast({
        title: "Error",
        description: "Failed to update post pin status. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle post upvoting
  const handleToggleUpvote = async (post: ForumPost) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to upvote posts.",
        variant: "destructive"
      });
      return;
    }

    try {
      await ForumService.togglePostUpvote(post.id, user.uid);
    } catch (error) {
      console.error('Error toggling upvote:', error);
      toast({
        title: "Error",
        description: "Failed to update upvote. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle comment creation
  const handleCreateReply = async () => {
    if (!user || !replyForm.body.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter a reply message.",
        variant: "destructive"
      });
      return;
    }

    try {
      const commentData = {
        postId: replyForm.postId,
        parentId: replyForm.parentId,
        body: replyForm.body.trim(),
        authorRole: userRole as "parent" | "teacher",
        authorId: user.uid,
        authorName: user.displayName || user.username,
      upvotes: 0,
        upvotedBy: [],
      hidden: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await ForumService.addComment(replyForm.postId, commentData);
      
      toast({
        title: "Reply Posted!",
        description: "Your reply has been added successfully.",
      });

      // Reset form and close dialog
      setReplyForm({ postId: "", parentId: null, body: "" });
      setReplyingTo(null);
      setIsReplyDialogOpen(false);
    } catch (error) {
      console.error('Error creating reply:', error);
      toast({
        title: "Error",
        description: "Failed to post reply. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle comment deletion
  const handleDeleteComment = async (postId: string, comment: ForumComment) => {
    if (!user || (comment.authorId !== user.uid && userRole !== "admin" && userRole !== "teacher")) {
      toast({
        title: "Permission Denied",
        description: "You can only delete your own comments.",
        variant: "destructive"
      });
      return;
    }

    if (window.confirm("Are you sure you want to delete this comment?")) {
      try {
        await ForumService.deleteComment(comment.id, postId);
        toast({
          title: "Comment Deleted",
          description: "The comment has been deleted successfully.",
        });
      } catch (error) {
        console.error('Error deleting comment:', error);
        toast({
          title: "Error",
          description: "Failed to delete comment. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  // Handle comment hiding/unhiding (teacher/admin only)
  const handleToggleCommentHidden = async (postId: string, commentId: string, hidden: boolean) => {
    if (!user || (userRole !== "admin" && userRole !== "teacher")) {
      toast({
        title: "Permission Denied",
        description: "Only teachers and admins can hide comments.",
        variant: "destructive"
      });
      return;
    }

    try {
      await ForumService.toggleCommentHidden(commentId, hidden);
      toast({
        title: hidden ? "Comment Hidden" : "Comment Unhidden",
        description: `Comment has been ${hidden ? "hidden" : "unhidden"}.`,
      });
    } catch (error) {
      console.error('Error toggling comment hidden status:', error);
      toast({
        title: "Error",
        description: "Failed to update comment status. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Handle comment upvoting
  const handleToggleCommentUpvote = async (commentId: string, userId: string) => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to upvote comments.",
        variant: "destructive"
      });
      return;
    }

    try {
      await ForumService.toggleCommentUpvote(commentId, user.uid);
    } catch (error) {
      console.error('Error toggling comment upvote:', error);
      toast({
        title: "Error",
        description: "Failed to update comment upvote. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Open edit dialog
  const openEditDialog = (post: ForumPost) => {
    setEditingPost(post);
    setEditForm({
      id: post.id,
      title: post.title,
      body: post.body,
      tag: post.tag,
      classId: post.classId || ""
    });
    setIsEditDialogOpen(true);
  };

  // Open reply dialog
  const openReplyDialog = (postId: string, parentId: string | null = null, authorName: string = "") => {
    setReplyingTo({ postId, parentId, authorName });
    setReplyForm({
      postId,
      parentId,
      body: ""
    });
    setIsReplyDialogOpen(true);
  };

  // Filter posts based on search query
  const filteredPosts = posts.filter(post => {
    const matchesSearch = searchQuery === "" || 
                         post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.body.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.authorName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Get tag badge styling
  const getTagBadge = (tag: Tag) => {
    const tagStyles = {
      general: "bg-gray-100 text-gray-800",
      question: "bg-blue-100 text-blue-800",
      advice: "bg-green-100 text-green-800",
      event: "bg-purple-100 text-purple-800",
      policy: "bg-orange-100 text-orange-800"
    };

    return (
      <Badge className={tagStyles[tag]} variant="secondary">
        {tag.charAt(0).toUpperCase() + tag.slice(1)}
      </Badge>
    );
  };

  // Format date
  const formatDate = (date: Date | any) => {
  try {
    // Handle different date formats
    let actualDate: Date;
    
    if (date && typeof date.toDate === 'function') {
      // Firestore Timestamp
      actualDate = date.toDate();
    } else if (date instanceof Date) {
      // Already a Date object
      actualDate = date;
    } else if (typeof date === 'string' || typeof date === 'number') {
      // String or number that can be parsed
      actualDate = new Date(date);
    } else {
      // Fallback for invalid dates
      return "Unknown date";
    }

    // Check if the date is valid
    if (isNaN(actualDate.getTime())) {
      return "Invalid date";
    }

    const now = new Date();
    const diffInMs = now.getTime() - actualDate.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMins < 1) return "Just now";
    if (diffInMins < 60) return `${diffInMins}m ago`;
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return actualDate.toLocaleDateString();
  } catch (error) {
    console.error('Error formatting date:', error, date);
    return "Unknown date";
  }
  };

  // Render comments tree
  const renderCommentsTree = (post: ForumPost, parentId: string | null = null, depth = 0) => {
    const comments = post.comments.filter(c => c.parentId === parentId);
    
    return comments.map(comment => (
      <div key={comment.id} className={`ml-${depth * 4} border-l-2 border-muted pl-4 mb-3`}>
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-sm">{comment.authorName}</span>
              <Badge variant="outline" className="text-xs">
                {comment.authorRole}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDate(comment.createdAt)}
              </span>
              {comment.hidden && (
                <Badge variant="destructive" className="text-xs">
                  Hidden
                </Badge>
              )}
                  </div>
            
            {!comment.hidden && (
              <p className="text-sm text-foreground mb-2">{comment.body}</p>
                )}

            <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                variant="ghost"
                onClick={() => handleToggleCommentUpvote(comment.id, comment.authorId)}
                className={`h-6 px-2 ${comment.upvotedBy.includes(user?.uid || "") ? "text-primary" : ""}`}
                    >
                <ArrowBigUp className="h-3 w-3 mr-1" />
                {comment.upvotes}
                    </Button>

                    <Button
                size="sm"
                      variant="ghost"
                onClick={() => openReplyDialog(post.id, comment.id, comment.authorName)}
                className="h-6 px-2"
              >
                <ReplyIcon className="h-3 w-3 mr-1" />
                Reply
              </Button>
              
              {(comment.authorId === user?.uid || userRole === "admin" || userRole === "teacher") && (
                <>
                  <Button
                      size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteComment(post.id, comment)}
                    className="h-6 px-2 text-destructive"
                    >
                    <Trash2 className="h-3 w-3" />
                    </Button>

                  {(userRole === "admin" || userRole === "teacher") && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleToggleCommentHidden(post.id, comment.id, !comment.hidden)}
                      className="h-6 px-2"
                    >
                      <EyeOff className="h-3 w-3" />
                    </Button>
                  )}
                </>
                  )}
            </div>
          </div>
                </div>

        {/* Render nested replies */}
        {renderCommentsTree(post, comment.id, depth + 1)}
              </div>
    ));
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading forum posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Community Forum</h1>
          <p className="text-muted-foreground mt-1">
            Connect with other parents and teachers, share experiences, and get advice
          </p>
        </div>

        {/* Create Post Button */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={createTestPost}
            className="flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Create Test Post</span>
          </Button>
          
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Post</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Forum Post</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="post-title">Title</Label>
            <Input
                    id="post-title"
                    value={postForm.title}
                    onChange={(e) => setPostForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Enter a descriptive title for your post..."
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="post-tag">Category</Label>
                    <Select value={postForm.tag} onValueChange={(value: Tag) => setPostForm(prev => ({ ...prev, tag: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General Discussion</SelectItem>
                        <SelectItem value="question">Question</SelectItem>
                        <SelectItem value="advice">Advice</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                        <SelectItem value="policy">Policy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {userRole === "teacher" && (
                    <div>
                      <Label htmlFor="post-class">Class (Optional)</Label>
                      <Select
                          value={postForm.classId || "all"}
                          onValueChange={(value) =>
                            setPostForm(prev => ({ ...prev, classId: value === "all" ? "" : value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select class" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Classes</SelectItem> {/* was value="" */}
                            {selectedClass && (
                              <SelectItem value={selectedClass.id}>{selectedClass.name}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>

                    </div>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="post-body">Content</Label>
                  <Textarea
                    id="post-body"
                    value={postForm.body}
                    onChange={(e) => setPostForm(prev => ({ ...prev, body: e.target.value }))}
                    placeholder="Share your thoughts, questions, or experiences..."
                    rows={6}
                  />
                </div>
                
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="flex-1">
                    Cancel
                  </Button>
                  <Button onClick={handleCreatePost} className="flex-1">
                    Create Post
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
            <SearchIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search posts, authors, or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          </div>

        <Select value={selectedTag} onValueChange={(value: Tag | "all") => setSelectedTag(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="all">All Tags</SelectItem>
            <SelectItem value="general">General</SelectItem>
            <SelectItem value="question">Question</SelectItem>
            <SelectItem value="advice">Advice</SelectItem>
            <SelectItem value="event">Event</SelectItem>
            <SelectItem value="policy">Policy</SelectItem>
            </SelectContent>
          </Select>

        <Select value={sortBy} onValueChange={(value: SortKey) => setSortBy(value)}>
            <SelectTrigger className="w-32">
            <SelectValue />
            </SelectTrigger>
            <SelectContent>
            <SelectItem value="hot">Trending</SelectItem>
            <SelectItem value="new">Latest</SelectItem>
              <SelectItem value="top">Top</SelectItem>
            </SelectContent>
          </Select>
      </div>

      {/* Posts List */}
              <div className="space-y-4">
        {filteredPosts.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No posts found</h3>
              <p className="text-muted-foreground">
                {searchQuery || selectedTag !== "all" 
                  ? "Try adjusting your search terms or filters."
                  : "Be the first to start a conversation in the community forum!"
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredPosts.map((post) => (
            <Card key={post.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      {post.isPinned && (
                        <Pin className="h-4 w-4 text-primary" />
                      )}
                      <CardTitle className="text-lg">{post.title}</CardTitle>
                      {getTagBadge(post.tag)}
                </div>
                    
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{post.authorName}</span>
                        <Badge variant="outline" className="text-xs">
                          {post.authorRole}
                        </Badge>
                </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(post.createdAt)}</span>
                </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        <span>{post.comments.length} replies</span>
              </div>
                      {post.classId && (
                        <div className="flex items-center gap-1">
                          <span className="text-xs bg-muted px-2 py-1 rounded">
                            Class-specific
                          </span>
                        </div>
                      )}
        </div>
      </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleUpvote(post)}
                      className={`${post.upvotedBy.includes(user?.uid || "") ? "text-primary" : ""}`}
                    >
                      <ArrowBigUp className="h-4 w-4 mr-1" />
                      {post.upvotes}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openReplyDialog(post.id, null, post.authorName)}
                    >
                      <ReplyIcon className="h-4 w-4 mr-1" />
                      Reply
                          </Button>
                    
                    {(post.authorId === user?.uid || userRole === "admin" || userRole === "teacher") && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(post)}
                        >
                            <Edit className="h-4 w-4" />
                          </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePost(post)}
                          className="text-destructive"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    
                    {(userRole === "admin" || userRole === "teacher") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTogglePin(post)}
                        className={post.isPinned ? "text-primary" : ""}
                      >
                        <Pin className="h-4 w-4" />
                          </Button>
                        )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <p className="text-foreground mb-4 whitespace-pre-wrap">{post.body}</p>
                
                {/* Comments Section */}
                {post.comments.length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3">Replies ({post.comments.length})</h4>
                    {renderCommentsTree(post)}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
                        </div>

      {/* Edit Post Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Forum Post</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter a descriptive title for your post..."
              />
                      </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-tag">Category</Label>
                <Select value={editForm.tag} onValueChange={(value: Tag) => setEditForm(prev => ({ ...prev, tag: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General Discussion</SelectItem>
                    <SelectItem value="question">Question</SelectItem>
                    <SelectItem value="advice">Advice</SelectItem>
                    <SelectItem value="event">Event</SelectItem>
                    <SelectItem value="policy">Policy</SelectItem>
                  </SelectContent>
                </Select>
                </div>

              {userRole === "teacher" && (
                <div>
                  <Label htmlFor="edit-class">Class (Optional)</Label>
                  <Select
                      value={editForm.classId || "all"}
                      onValueChange={(value) =>
                        setEditForm(prev => ({ ...prev, classId: value === "all" ? "" : value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem> {/* was value="" */}
                        {selectedClass && (
                          <SelectItem value={selectedClass.id}>{selectedClass.name}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
              )}
            </div>
            
            <div>
              <Label htmlFor="edit-body">Content</Label>
              <Textarea
                id="edit-body"
                value={editForm.body}
                onChange={(e) => setEditForm(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Share your thoughts, questions, or experiences..."
                rows={6}
              />
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleEditPost} className="flex-1">
                Update Post
              </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>

      {/* Reply Dialog */}
      <Dialog open={isReplyDialogOpen} onOpenChange={setIsReplyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Reply to {replyingTo?.parentId ? `@${replyingTo.authorName}` : "Post"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reply-body">Your Reply</Label>
              <Textarea
                id="reply-body"
                value={replyForm.body}
                onChange={(e) => setReplyForm(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Write your reply..."
                rows={4}
              />
      </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsReplyDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleCreateReply} className="flex-1">
                Post Reply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
