import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Eye, Download, Star, MessageCircle, Clock, User, FileText } from "lucide-react";
import { Submission, Feedback, Assignment } from "@/lib/types";
import { SubmissionService } from "@/lib/services/assignments";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface TeacherSubmissionViewProps {
  assignmentId: string;
  onBack: () => void;
}

interface SubmissionWithDetails extends Submission {
  assignment?: Assignment;
  studentName?: string;
  parentName?: string;
}

export const TeacherSubmissionView = ({ assignmentId, onBack }: TeacherSubmissionViewProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [submissions, setSubmissions] = useState<SubmissionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionWithDetails | null>(null);
  const [feedbackForm, setFeedbackForm] = useState({
    points: 0,
    message: "",
    emoji: "👍"
  });
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Load submissions for this assignment
  useEffect(() => {
    const loadSubmissions = async () => {
      if (!assignmentId) return;
      
      setIsLoading(true);
      try {
        // Get all submissions for this assignment
        const submissionsQuery = query(
          collection(db, 'submissions'),
          where('assignmentId', '==', assignmentId)
        );
        const submissionsSnapshot = await getDocs(submissionsQuery);
        
        const submissionsData: SubmissionWithDetails[] = [];
        
        for (const submissionDoc of submissionsSnapshot.docs) {
          const submissionData = submissionDoc.data();
          const submission: SubmissionWithDetails = {
            id: submissionDoc.id,
            ...submissionData,
            submittedAt: submissionData.submittedAt?.toDate ? submissionData.submittedAt.toDate() : new Date(submissionData.submittedAt),
            feedback: submissionData.feedback ? {
              ...submissionData.feedback,
              createdAt: submissionData.feedback.createdAt?.toDate ? submissionData.feedback.createdAt.toDate() : new Date(submissionData.feedback.createdAt)
            } : undefined
          };

          // Get assignment details
          try {
            const assignmentDoc = await getDoc(doc(db, 'assignments', assignmentId));
            if (assignmentDoc.exists()) {
              submission.assignment = {
                id: assignmentDoc.id,
                ...assignmentDoc.data()
              } as Assignment;
            }
          } catch (error) {
            console.error('Error loading assignment details:', error);
          }

          // Get student details
          try {
            const studentDoc = await getDoc(doc(db, 'students', submissionData.studentId));
            if (studentDoc.exists()) {
              submission.studentName = studentDoc.data().name;
            }
          } catch (error) {
            console.error('Error loading student details:', error);
          }

          // Get parent details
          try {
            const parentDoc = await getDoc(doc(db, 'users', submissionData.parentId));
            if (parentDoc.exists()) {
              submission.parentName = parentDoc.data().displayName;
            }
          } catch (error) {
            console.error('Error loading parent details:', error);
          }

          submissionsData.push(submission);
        }

        // Sort by submission date (newest first)
        submissionsData.sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime());
        
        setSubmissions(submissionsData);
      } catch (error) {
        console.error('Error loading submissions:', error);
        toast({
          title: "Error",
          description: "Failed to load submissions. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadSubmissions();
  }, [assignmentId, toast]);

  const handleFeedbackSubmit = async () => {
    if (!selectedSubmission || !feedbackForm.message.trim()) {
      toast({
        title: "Error",
        description: "Please provide feedback message and points.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmittingFeedback(true);
    try {
      // Submit feedback
      await SubmissionService.provideFeedback(selectedSubmission.id, {
        teacherId: user!.uid,
        message: feedbackForm.message,
        emoji: feedbackForm.emoji,
        points: feedbackForm.points
      });

      // Update submission status
      await SubmissionService.updateSubmissionStatus(selectedSubmission.id, 'approved');

      toast({
        title: "Feedback Submitted",
        description: "Feedback has been submitted successfully.",
      });

      // Refresh submissions
      const updatedSubmissions = submissions.map(sub => 
        sub.id === selectedSubmission.id 
          ? {
              ...sub,
              status: 'approved',
              points: feedbackForm.points,
              feedback: {
                id: selectedSubmission.id,
                teacherId: user!.uid,
                message: feedbackForm.message,
                emoji: feedbackForm.emoji,
                points: feedbackForm.points,
                createdAt: new Date()
              }
            }
          : sub
      );
      setSubmissions(updatedSubmissions);

      // Reset form
      setFeedbackForm({ points: 0, message: "", emoji: "👍" });
      setSelectedSubmission(null);

    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'submitted': return 'default';
      case 'approved': return 'success';
      case 'needsRevision': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'submitted': return 'Submitted';
      case 'approved': return 'Approved';
      case 'needsRevision': return 'Needs Revision';
      default: return 'Unknown';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading submissions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Assignments
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Assignment Submissions</h1>
            <p className="text-muted-foreground">
              {submissions.length} submission{submissions.length !== 1 ? 's' : ''} received
            </p>
          </div>
        </div>
      </div>

      {/* Submissions List */}
      {submissions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No submissions yet</h3>
            <p className="text-muted-foreground">
              Students haven't submitted any work for this assignment yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <Card key={submission.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Badge variant={getStatusColor(submission.status)}>
                        {getStatusText(submission.status)}
                      </Badge>
                      {submission.points > 0 && (
                        <Badge variant="outline" className="flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          {submission.points} points
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{submission.studentName || 'Unknown Student'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        <span>{submission.parentName || 'Unknown Parent'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        <span>{submission.completionTimeMinutes} minutes</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4" />
                        <span>{submission.feedback ? 'Feedback provided' : 'No feedback'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {!submission.feedback && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            onClick={() => setSelectedSubmission(submission)}
                          >
                            Provide Feedback
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Provide Feedback</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <label className="text-sm font-medium">Points</label>
                              <Input
                                type="number"
                                min="0"
                                max={submission.assignment?.points || 100}
                                value={feedbackForm.points}
                                onChange={(e) => setFeedbackForm(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                                placeholder="Enter points"
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium">Emoji</label>
                              <Select value={feedbackForm.emoji} onValueChange={(value) => setFeedbackForm(prev => ({ ...prev, emoji: value }))}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="👍">👍 Good</SelectItem>
                                  <SelectItem value="🎉">🎉 Excellent</SelectItem>
                                  <SelectItem value="💪">💪 Keep it up</SelectItem>
                                  <SelectItem value="🌟">🌟 Outstanding</SelectItem>
                                  <SelectItem value="📚">📚 Study more</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <label className="text-sm font-medium">Feedback Message</label>
                              <Textarea
                                value={feedbackForm.message}
                                onChange={(e) => setFeedbackForm(prev => ({ ...prev, message: e.target.value }))}
                                placeholder="Provide constructive feedback..."
                                rows={3}
                              />
                            </div>
                            <Button 
                              onClick={handleFeedbackSubmit} 
                              disabled={isSubmittingFeedback}
                              className="w-full"
                            >
                              {isSubmittingFeedback ? "Submitting..." : "Submit Feedback"}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* Files */}
                <div className="space-y-3">
                  <h4 className="font-medium">Submitted Files</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {submission.files.map((file) => (
                      <div key={file.id} className="flex items-center gap-3 p-3 border rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {Math.round(file.size / 1024)} KB
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" asChild>
                            <a href={file.url} target="_blank" rel="noopener noreferrer">
                              <Eye className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button size="sm" variant="outline" asChild>
                            <a href={file.url} download={file.filename}>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Feedback Display */}
                {submission.feedback && (
                  <div className="mt-4 p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2">Teacher Feedback</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{submission.feedback.emoji}</span>
                      <Badge variant="outline">
                        {submission.feedback.points} points
                      </Badge>
                    </div>
                    <p className="text-sm">{submission.feedback.message}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Provided on {submission.feedback.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
