import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, Edit, Trash2, MoreHorizontal } from 'lucide-react';
import { Comment } from '@/lib/types';
import { useAuth } from '@/contexts/AuthContext';

interface CommentSectionProps {
  assignmentId: string;
  comments: Comment[];
  onCommentAdded: (comment: Comment) => void;
  onCommentUpdated: (commentId: string, updates: Partial<Comment>) => void;
  onCommentDeleted: (commentId: string) => void;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  assignmentId,
  comments,
  onCommentAdded,
  onCommentUpdated,
  onCommentDeleted
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !user) return;
    
    setIsSubmitting(true);
    try {
      const commentData = {
        userId: user.uid,
        userDisplayName: user.displayName || 'Unknown User',
        userRole: user.role as 'teacher' | 'parent' | 'admin',
        content: newComment.trim()
      };

      // Call the parent handler
      const tempComment: Comment = {
        id: `temp-${Date.now()}`,
        ...commentData,
        createdAt: new Date()
      };
      
      onCommentAdded(tempComment);
      setNewComment('');
      
      toast({
        title: "Comment added",
        description: "Your comment has been posted successfully.",
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditContent(comment.content);
  };

  const handleUpdateComment = async () => {
    if (!editContent.trim() || !editingCommentId) return;
    
    try {
      onCommentUpdated(editingCommentId, { content: editContent.trim() });
      setEditingCommentId(null);
      setEditContent('');
      
      toast({
        title: "Comment updated",
        description: "Your comment has been updated successfully.",
      });
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Error",
        description: "Failed to update comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;
    
    try {
      onCommentDeleted(commentId);
      
      toast({
        title: "Comment deleted",
        description: "Your comment has been deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const canEditComment = (comment: Comment) => {
    return user && (user.uid === comment.userId || user.role === 'admin');
  };

  const canDeleteComment = (comment: Comment) => {
    return user && (user.uid === comment.userId || user.role === 'admin' || user.role === 'teacher');
  };

  const formatTimeAgo = (date: any) => {
    try {
      let actualDate: Date;
      
      // Handle Firestore Timestamp
      if (date && typeof date === 'object' && date.toDate) {
        actualDate = date.toDate();
      }
      // Handle Date object
      else if (date instanceof Date) {
        actualDate = date;
      }
      // Handle string dates
      else if (typeof date === 'string') {
        actualDate = new Date(date);
      }
      // Fallback
      else {
        return 'Unknown time';
      }

      const now = new Date();
      const diffInMs = now.getTime() - actualDate.getTime();
      const diffInMins = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInMins < 1) {
        return 'Just now';
      } else if (diffInMins < 60) {
        return `${diffInMins} minutes ago`;
      } else if (diffInHours < 24) {
        return `${diffInHours} hours ago`;
      } else {
        return `${diffInDays} days ago`;
      }
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Unknown time';
    }
  };

  return (
    <div className="space-y-4">
      {/* Comment Header */}
      <div className="flex items-center space-x-2">
        <MessageCircle className="h-5 w-5 text-muted-foreground" />
        <h4 className="font-medium">Comments ({comments.length})</h4>
      </div>

      {/* Add Comment Form */}
      {user && (
        <div className="flex space-x-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">
              {user.displayName?.charAt(0) || user.email?.charAt(0) || 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <Textarea
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="min-h-[80px] resize-none"
            />
            <div className="flex justify-between items-center">
              <div className="text-xs text-muted-foreground">
                Press Enter to submit, Shift+Enter for new line
              </div>
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}
                size="sm"
                className="flex items-center space-x-2"
              >
                <Send className="h-4 w-4" />
                <span>Post Comment</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <div key={comment.id} className="flex space-x-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {comment.userDisplayName.charAt(0)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <div className="bg-muted/50 rounded-lg p-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-sm">{comment.userDisplayName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {comment.userRole}
                    </Badge>
                    {comment.isEdited && (
                      <Badge variant="outline" className="text-xs">
                        Edited
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(comment.createdAt)}
                    </span>
                    {(canEditComment(comment) || canDeleteComment(comment)) && (
                      <div className="flex items-center space-x-1">
                        {canEditComment(comment) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditComment(comment)}
                            className="h-6 w-6 p-0 hover:bg-muted"
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                        )}
                        {canDeleteComment(comment) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="h-6 w-6 p-0 hover:bg-muted text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {editingCommentId === comment.id ? (
                  <div className="mt-3 space-y-2">
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="min-h-[60px] resize-none"
                    />
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCommentId(null);
                          setEditContent('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleUpdateComment}
                        disabled={!editContent.trim()}
                      >
                        Update
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm mt-2 whitespace-pre-wrap">{comment.content}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {comments.length === 0 && (
        <div className="text-center py-6 text-muted-foreground">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No comments yet. Be the first to comment!</p>
        </div>
      )}
    </div>
  );
};
