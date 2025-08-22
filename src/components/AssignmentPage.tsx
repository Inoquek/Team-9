import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Calendar, Clock, CheckCircle, Plus, Edit, Trash2, Eye, Users, MessageCircle, File, Download } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AssignmentService } from "@/lib/services/assignments";
import { Assignment, AssignmentWithComments, Comment } from "@/lib/types";
import { CommentSection } from "./CommentSection";
import { FileViewer } from "./FileViewer";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AssignmentPageProps {
  userRole: "parent" | "teacher" | "admin";
}

export const AssignmentPage = ({ userRole }: AssignmentPageProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filterStatus, setFilterStatus] = useState("all");
  const [assignments, setAssignments] = useState<AssignmentWithComments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithComments | null>(null);
  const [showComments, setShowComments] = useState<string | null>(null);

  // Load assignments based on user role
  useEffect(() => {
    const loadAssignments = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        let assignmentsData: AssignmentWithComments[] = [];
        
        if (user.role === 'teacher') {
          // For teachers, get assignments from their classes
          try {
            // Get teacher's classes first
            const classesQuery = query(
              collection(db, 'classes'),
              where('teacherId', '==', user.uid),
              where('isActive', '==', true)
            );
            const classesSnapshot = await getDocs(classesQuery);
            
            // Get assignments from all teacher's classes
            for (const classDoc of classesSnapshot.docs) {
              const classAssignments = await AssignmentService.getClassAssignmentsWithComments(classDoc.id);
              assignmentsData.push(...classAssignments);
            }
          } catch (error) {
            console.error('Error loading teacher assignments:', error);
          }
        } else if (user.role === 'parent') {
          // For parents, get assignments from their child's class
          try {
            // Get parent's student(s) first
            const studentsQuery = query(
              collection(db, 'students'),
              where('parentId', '==', user.uid),
              where('isActive', '==', true)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            
            // Get assignments from student's class
            for (const studentDoc of studentsSnapshot.docs) {
              const studentData = studentDoc.data();
              if (studentData.classId) {
                const classAssignments = await AssignmentService.getClassAssignmentsWithComments(studentData.classId);
                assignmentsData.push(...classAssignments);
              }
            }
          } catch (error) {
            console.error('Error loading parent assignments:', error);
          }
        } else if (user.role === 'admin') {
          // For admins, get all assignments
          try {
            // Get all classes first
            const classesQuery = query(collection(db, 'classes'), where('isActive', '==', true));
            const classesSnapshot = await getDocs(classesQuery);
            
            // Get assignments from all classes
            for (const classDoc of classesSnapshot.docs) {
              const classAssignments = await AssignmentService.getClassAssignmentsWithComments(classDoc.id);
              assignmentsData.push(...classAssignments);
            }
          } catch (error) {
            console.error('Error loading admin assignments:', error);
          }
        }
        
        setAssignments(assignmentsData);
      } catch (error) {
        console.error('Error loading assignments:', error);
        toast({
          title: "Error",
          description: "Failed to load assignments. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadAssignments();
  }, [user, toast]);

  const filteredAssignments = assignments.filter(assignment => {
    if (filterStatus === "all") return true;
    return assignment.status === filterStatus;
  });

  const handleCommentAdded = async (assignmentId: string, comment: Comment) => {
    try {
      // Add comment to database
      await AssignmentService.addComment(assignmentId, {
        userId: comment.userId,
        userDisplayName: comment.userDisplayName,
        userRole: comment.userRole,
        content: comment.content
      });
      
      // Update local state
      setAssignments(prev => prev.map(assignment => {
        if (assignment.id === assignmentId) {
          return {
            ...assignment,
            comments: [...(assignment.comments || []), comment],
            commentCount: (assignment.commentCount || 0) + 1
          };
        }
        return assignment;
      }));
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCommentUpdated = async (assignmentId: string, commentId: string, updates: Partial<Comment>) => {
    try {
      // Update comment in database
      await AssignmentService.updateComment(assignmentId, commentId, updates);
      
      // Update local state
      setAssignments(prev => prev.map(assignment => {
        if (assignment.id === assignmentId) {
          return {
            ...assignment,
            comments: assignment.comments?.map(comment => 
              comment.id === commentId ? { ...comment, ...updates } : comment
            ) || []
          };
        }
        return assignment;
      }));
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Error",
        description: "Failed to update comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCommentDeleted = async (assignmentId: string, commentId: string) => {
    try {
      // Delete comment from database
      await AssignmentService.deleteComment(assignmentId, commentId);
      
      // Update local state
      setAssignments(prev => prev.map(assignment => {
        if (assignment.id === assignmentId) {
          return {
            ...assignment,
            comments: assignment.comments?.filter(comment => comment.id !== commentId) || [],
            commentCount: Math.max(0, (assignment.commentCount || 0) - 1)
          };
        }
        return assignment;
      }));
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "success";
      case "archived": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="h-4 w-4" />;
      case "archived": return <BookOpen className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - new Date(date).getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMins < 60) {
      return `${diffInMins} minutes ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours} hours ago`;
    } else {
      return `${diffInDays} days ago`;
    }
  };

  const formatDueDate = (dueDate: any) => {
    try {
      // Handle Firestore Timestamp
      if (dueDate && typeof dueDate === 'object' && dueDate.toDate) {
        return dueDate.toDate().toLocaleDateString();
      }
      // Handle Date object
      if (dueDate instanceof Date) {
        return dueDate.toLocaleDateString();
      }
      // Handle string dates
      if (typeof dueDate === 'string') {
        const date = new Date(dueDate);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      }
      return 'No due date';
    } catch (error) {
      console.error('Error formatting due date:', error);
      return 'Invalid date';
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {userRole === "parent" ? "Student Assignments" : "Class Assignments"}
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
              <SelectItem value="all">All Assignments</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
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

      {/* Assignment Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{assignments.length}</p>
                <p className="text-sm text-muted-foreground">Total Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">
                  {assignments.filter(a => a.status === "active").length}
                </p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <MessageCircle className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">
                  {assignments.reduce((total, a) => total + (a.commentCount || 0), 0)}
                </p>
                <p className="text-sm text-muted-foreground">Total Comments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-accent" />
              <div>
                <p className="text-2xl font-bold">
                  {assignments.length > 0 ? Math.round((assignments.filter(a => a.status === "active").length / assignments.length) * 100) : 0}%
                </p>
                <p className="text-sm text-muted-foreground">Active Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Assignments List */}
      {assignments.length > 0 ? (
        <div className="grid gap-4">
          {filteredAssignments.map((assignment) => (
            <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <CardTitle className="text-lg">{assignment.title}</CardTitle>
                      <Badge variant={getStatusColor(assignment.status)} className="flex items-center space-x-1">
                        {getStatusIcon(assignment.status)}
                        <span className="capitalize">{assignment.status}</span>
                      </Badge>
                    </div>
                                         <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                       <div className="flex items-center space-x-1">
                         <Calendar className="h-4 w-4" />
                         <span>Due: {formatDueDate(assignment.dueDate)}</span>
                       </div>
                      <Badge variant="outline">{assignment.type}</Badge>
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="h-4 w-4" />
                        <span>{assignment.commentCount || 0} comments</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowComments(showComments === assignment.id ? null : assignment.id)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedAssignment(assignment)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{assignment.description}</p>
                
                {/* Assignment Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span>Type: {assignment.type}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>Est. Time: {assignment.estimatedTime} min</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${(a.completedBy / Math.max(1, a.totalStudents)) * 100}%` }} />
                  </div>
                </div>

                {/* Attachments */}
                {assignment.attachments && assignment.attachments.length > 0 && (
                  <FileViewer 
                    files={assignment.attachments}
                    title="Attachments"
                    showDownloadButton={true}
                    showPreviewButton={true}
                    compact={false}
                  />
                )}

                {/* Instructions */}
                {assignment.instructions && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <h4 className="font-medium text-sm mb-2">Instructions:</h4>
                    <p className="text-sm text-muted-foreground">{assignment.instructions}</p>
                  </div>
                )}

                {/* Comments Section */}
                {showComments === assignment.id && (
                  <div className="border-t pt-4">
                    <CommentSection
                      assignmentId={assignment.id}
                      comments={assignment.comments || []}
                      onCommentAdded={(comment) => handleCommentAdded(assignment.id, comment)}
                      onCommentUpdated={(commentId, updates) => handleCommentUpdated(assignment.id, commentId, updates)}
                      onCommentDeleted={(commentId) => handleCommentDeleted(assignment.id, commentId)}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
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
            {userRole === "teacher" && (
              <p className="text-sm text-muted-foreground mt-2">
                Create assignments from your Teacher Dashboard to get started.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Assignment Detail Dialog */}
      <Dialog open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedAssignment && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAssignment.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Description</h4>
                  <p className="text-muted-foreground">{selectedAssignment.description}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Type</h4>
                    <Badge variant="outline">{selectedAssignment.type}</Badge>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Due Date</h4>
                    <p className="text-muted-foreground">
                      {formatDueDate(selectedAssignment.dueDate)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Estimated Time</h4>
                    <p className="text-muted-foreground">{selectedAssignment.estimatedTime} minutes</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Points</h4>
                    <p className="text-muted-foreground">{selectedAssignment.points}</p>
                  </div>
                </div>

                {selectedAssignment.instructions && (
                  <div>
                    <h4 className="font-medium mb-2">Instructions</h4>
                    <p className="text-muted-foreground">{selectedAssignment.instructions}</p>
                  </div>
                )}

                {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Attachments</h4>
                    <FileViewer 
                      files={selectedAssignment.attachments}
                      title=""
                      showDownloadButton={true}
                      showPreviewButton={true}
                      compact={true}
                    />
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">Comments ({selectedAssignment.commentCount || 0})</h4>
                  <CommentSection
                    assignmentId={selectedAssignment.id}
                    comments={selectedAssignment.comments || []}
                    onCommentAdded={(comment) => handleCommentAdded(selectedAssignment.id, comment)}
                    onCommentUpdated={(commentId, updates) => handleCommentUpdated(selectedAssignment.id, commentId, updates)}
                    onCommentDeleted={(commentId) => handleCommentDeleted(selectedAssignment.id, commentId)}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
