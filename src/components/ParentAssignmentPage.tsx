import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  CheckCircle, 
  Eye, 
  MessageCircle, 
  File, 
  Download,
  Play,
  Target,
  TrendingUp,
  Award,
  ChevronUp,
  ChevronDown,
  Upload
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { AssignmentService, SubmissionService } from '@/lib/services/assignments';
import { Assignment, AssignmentWithComments, Submission } from '@/lib/types';
import { StudyTimeTracker } from './StudyTimeTracker';
import { AssignmentSubmissionForm } from './AssignmentSubmissionForm';
import { StudyTimeDashboard } from './StudyTimeDashboard';
import { CommentSection } from './CommentSection';
import { FileViewer } from './FileViewer';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ParentAssignmentPageProps {
  onNavigate: (page: string) => void;
}

// Utility function to safely convert Firestore timestamps to Date objects
const safeDateConversion = (dateValue: any): Date => {
  if (!dateValue) {
    console.log('safeDateConversion: No date value provided, using current date');
    return new Date();
  }
  
  // If it's already a Date object, return it
  if (dateValue instanceof Date) {
    console.log('safeDateConversion: Already a Date object');
    return dateValue;
  }
  
  // If it's a Firestore timestamp, convert it
  if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue) {
    console.log('safeDateConversion: Converting Firestore timestamp');
    return dateValue.toDate();
  }
  
  // If it's a string, try to parse it
  if (typeof dateValue === 'string') {
    console.log('safeDateConversion: Parsing string date:', dateValue);
    const parsed = new Date(dateValue);
    if (!isNaN(parsed.getTime())) return parsed;
  }
  
  // If it's a number (timestamp), convert it
  if (typeof dateValue === 'number') {
    console.log('safeDateConversion: Converting numeric timestamp');
    return new Date(dateValue);
  }
  
  // Log the unexpected type
  console.log('safeDateConversion: Unexpected date type:', typeof dateValue, dateValue);
  
  // Fallback to current date
  return new Date();
};

export const ParentAssignmentPage: React.FC<ParentAssignmentPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<AssignmentWithComments[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithComments | null>(null);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [completionTimes, setCompletionTimes] = useState<Record<string, number>>({});
  const [showSubmissionForm, setShowSubmissionForm] = useState<string | null>(null);
  const [showStudyDashboard, setShowStudyDashboard] = useState(false);
  const [studentInfo, setStudentInfo] = useState<{ id: string; name: string } | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(new Set());

  // Load assignments and student info
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        // Get parent's student(s)
        const studentsQuery = query(
          collection(db, 'students'),
          where('parentId', '==', user.uid),
          where('isActive', '==', true)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        if (studentsSnapshot.empty) {
          toast({
            title: "No students found",
            description: "Please contact your teacher to be assigned to a student.",
            variant: "destructive"
          });
          return;
        }

        const studentDoc = studentsSnapshot.docs[0];
        const studentData = studentDoc.data();
        setStudentInfo({
          id: studentDoc.id,
          name: studentData.name
        });

        // Get assignments for student's class
        if (studentData.classId) {
          const classAssignments = await AssignmentService.getClassAssignmentsWithComments(studentData.classId);
          console.log('Loaded assignments:', classAssignments);
          setAssignments(classAssignments);
        }

        // Get existing submissions for the student
        const studentSubmissions = await SubmissionService.getStudentSubmissions(studentDoc.id);
        console.log('Loaded student submissions:', studentSubmissions);
        console.log('Student ID:', studentDoc.id);
        console.log('Submissions details:', studentSubmissions.map(s => ({
          id: s.id,
          assignmentId: s.assignmentId,
          status: s.status,
          isPlaceholder: s.isPlaceholder,
          submittedBy: s.submittedBy,
          studentId: s.studentId,
          parentId: s.parentId
        })));
        setSubmissions(studentSubmissions);

        // Load completion times from submissions
        const times: Record<string, number> = {};
        studentSubmissions.forEach(sub => {
          times[sub.assignmentId] = sub.completionTimeMinutes || 0;
        });
        setCompletionTimes(times);

      } catch (error) {
        console.error('Error loading data:', error);
        toast({
          title: "Error",
          description: "Failed to load assignments. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [user, toast]);

  const handleTimeComplete = (assignmentId: string, minutes: number) => {
    setCompletionTimes(prev => ({ ...prev, [assignmentId]: minutes }));
    setActiveTimer(null);
    
    toast({
      title: "Time tracked!",
      description: `You spent ${minutes} minutes on this assignment.`,
    });
  };

  const handleSubmissionComplete = (submissionId: string) => {
    setShowSubmissionForm(null);
    
    // Refresh submissions
    const refreshSubmissions = async () => {
      try {
        if (!studentInfo) return;
        const studentSubmissions = await SubmissionService.getStudentSubmissions(studentInfo.id);
        setSubmissions(studentSubmissions);
        
        // Update completion times
        const times: Record<string, number> = {};
        studentSubmissions.forEach(sub => {
          times[sub.assignmentId] = sub.completionTimeMinutes || 0;
        });
        setCompletionTimes(times);
      } catch (error) {
        console.error('Error refreshing submissions:', error);
      }
    };
    
    refreshSubmissions();
  };

  const getSubmissionStatus = (assignmentId: string) => {
    const submission = submissions.find(sub => sub.assignmentId === assignmentId);
    console.log(`getSubmissionStatus for assignment ${assignmentId}:`, {
      submission,
      submissionId: submission?.id,
      status: submission?.status,
      isPlaceholder: submission?.isPlaceholder,
      submittedBy: submission?.submittedBy,
      allSubmissions: submissions.map(s => ({ id: s.id, assignmentId: s.assignmentId, status: s.status, isPlaceholder: s.isPlaceholder }))
    });
    if (!submission) return 'not_started';
    return submission.status;
  };

  // Helper function to determine if assignment is completed from parent perspective
  const isAssignmentCompleted = (assignmentId: string) => {
    const submission = submissions.find(sub => sub.assignmentId === assignmentId);
    if (!submission) return false;
    // Assignment is completed if it's approved or completed (these represent graded work)
    return submission.status === 'approved' || submission.status === 'completed';
  };

  // Helper function to determine if assignment is not started (has work to do)
  const isAssignmentNotStarted = (assignmentId: string) => {
    const submission = submissions.find(sub => sub.assignmentId === assignmentId);
    if (!submission) return true; // No submission = not started
    // Assignment is not started if not yet approved/completed
    return submission.status !== 'approved' && submission.status !== 'completed';
  };

  // Helper function to check if assignment has a placeholder submission (teacher-created)
  const hasPlaceholderSubmission = (assignmentId: string) => {
    const submission = submissions.find(sub => sub.assignmentId === assignmentId);
    return submission && (submission.isPlaceholder || submission.submittedBy === 'teacher');
  };

  // Helper function to toggle assignment expansion
  const toggleAssignmentExpansion = (assignmentId: string) => {
    setExpandedAssignments(prev => {
      const newSet = new Set(prev);
      if (newSet.has(assignmentId)) {
        newSet.delete(assignmentId);
      } else {
        newSet.add(assignmentId);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': 
      case 'completed': return 'success';
      case 'submitted': 
      case 'pending': 
      case 'needsRevision': return 'warning';
      case 'not_started': return 'secondary';
      default: return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': 
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'submitted': 
      case 'pending': 
      case 'needsRevision': return <Upload className="h-4 w-4" />;
      case 'not_started': return <BookOpen className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const formatTimeAgo = (date: any) => {
    const safeDate = safeDateConversion(date);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - safeDate.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return safeDate.toLocaleDateString();
  };

  const filteredAssignments = assignments.filter(assignment => {
    if (filterStatus === "all") return true;
    
    const submissionStatus = getSubmissionStatus(assignment.id);
    
    if (filterStatus === "not_started") {
      return submissionStatus === 'not_started';
    }
    if (filterStatus === "submitted") {
      return submissionStatus === 'submitted' || submissionStatus === 'pending' || submissionStatus === 'needsRevision';
    }
    if (filterStatus === "graded") {
      return submissionStatus === 'approved' || submissionStatus === 'completed';
    }
    if (filterStatus === "active") {
      return assignment.status === "active";
    }
    if (filterStatus === "archived") {
      return assignment.status === "archived";
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!studentInfo) {
    return (
      <div className="text-center py-8">
        <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-semibold mb-2">No Student Assigned</h3>
        <p className="text-muted-foreground mb-4">
          Please contact your teacher to be assigned to a student.
        </p>
        <Button onClick={() => onNavigate('dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-muted-foreground">
            Complete assignments for {studentInfo.name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowStudyDashboard(!showStudyDashboard)}
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Study Dashboard
          </Button>
        </div>
      </div>

      {/* Study Time Dashboard */}
      {showStudyDashboard && (
        <StudyTimeDashboard
          studentId={studentInfo.id}
          studentName={studentInfo.name}
        />
      )}

      {/* Filter Section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              <SelectItem value="not_started">Not Started</SelectItem>
              <SelectItem value="submitted">Submitted</SelectItem>
              <SelectItem value="graded">Graded</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* Filter Stats */}
        <div className="text-sm text-muted-foreground">
          {(() => {
            const totalAssignments = assignments.length;
            const notStartedCount = assignments.filter(a => getSubmissionStatus(a.id) === 'not_started').length;
            const submittedCount = assignments.filter(a => {
              const status = getSubmissionStatus(a.id);
              return status === 'submitted' || status === 'pending' || status === 'needsRevision';
            }).length;
            const gradedCount = assignments.filter(a => {
              const status = getSubmissionStatus(a.id);
              return status === 'approved' || status === 'completed';
            }).length;
            
            if (filterStatus === "all") {
              return `Showing ${filteredAssignments.length} of ${totalAssignments} assignments`;
            } else if (filterStatus === "not_started") {
              return `${notStartedCount} not started assignment${notStartedCount !== 1 ? 's' : ''}`;
            } else if (filterStatus === "submitted") {
              return `${submittedCount} submitted assignment${submittedCount !== 1 ? 's' : ''}`;
            } else if (filterStatus === "graded") {
              return `${gradedCount} graded assignment${gradedCount !== 1 ? 's' : ''}`;
            } else {
              return `${filteredAssignments.length} ${filterStatus} assignment${filteredAssignments.length !== 1 ? 's' : ''}`;
            }
          })()}
        </div>
      </div>

      {/* Assignments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredAssignments.map((assignment) => {
          try {
            // Debug logging
            console.log('Rendering assignment:', {
              id: assignment.id,
              title: assignment.title,
              dueDate: assignment.dueDate,
              dueDateType: typeof assignment.dueDate,
              dueDateConstructor: assignment.dueDate?.constructor?.name,
              hasToDate: assignment.dueDate && typeof assignment.dueDate === 'object' && 'toDate' in assignment.dueDate
            });
            
            const status = getSubmissionStatus(assignment.id);
            const completionTime = completionTimes[assignment.id] || 0;
            const hasTimer = activeTimer === assignment.id;
            const safeDueDate = safeDateConversion(assignment.dueDate);

            return (
              <Card key={assignment.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{assignment.title}</CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        {/* Student Progress Status */}
                        <Badge variant={getStatusColor(status) as any}>
                          {getStatusIcon(status)}
                          {(() => {
                            switch (status) {
                              case 'not_started': return 'Incomplete';
                              case 'submitted': 
                              case 'pending': 
                              case 'needsRevision': return 'Submitted';
                              case 'approved': 
                              case 'completed': return 'Graded';
                              default: return 'Incomplete';
                            }
                          })()}
                        </Badge>
                        
                        {/* Assignment Type with Icon */}
                        <Badge variant="outline" className="flex items-center gap-1">
                          {(() => {
                            const typeIcons = {
                              'alphabet-time': '🔤',
                              'vocabulary-time': '📚',
                              'sight-words-time': '👁️',
                              'reading-time': '📖',
                              'post-programme-test': '📝'
                            };
                            return typeIcons[assignment.type] || '📋';
                          })()}
                          {assignment.type.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Badge>
                        
                        {/* Points Badge */}
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                          ⭐ {assignment.points} pts
                        </Badge>
                        
                        {/* Due Date Status */}
                        {(() => {
                          const now = new Date();
                          const dueDate = safeDateConversion(assignment.dueDate);
                          const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                          
                          if (daysUntilDue < 0) {
                            return (
                              <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
                                ⏰ Overdue
                              </Badge>
                            );
                          } else if (daysUntilDue <= 3) {
                            return (
                              <Badge variant="warning" className="bg-orange-100 text-orange-700 border-orange-200">
                                ⏰ Due Soon
                              </Badge>
                            );
                          } else if (daysUntilDue <= 7) {
                            return (
                              <Badge variant="outline" className="bg-yellow-100 text-yellow-600 border-yellow-200">
                                📅 This Week
                              </Badge>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {/* Collapse/Expand Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleAssignmentExpansion(assignment.id)}
                        title={expandedAssignments.has(assignment.id) ? "Collapse" : "Expand"}
                      >
                        {expandedAssignments.has(assignment.id) ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <div className="text-right text-sm text-muted-foreground">
                        <div>Due: {safeDueDate.toLocaleDateString()}</div>
                        <div>{assignment.points} points</div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                {/* Collapsible Content */}
                {expandedAssignments.has(assignment.id) ? (
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {assignment.description}
                    </p>

                  {/* Study Timer - Only show if not a placeholder submission */}
                  {!hasTimer && status === 'not_started' && !hasPlaceholderSubmission(assignment.id) && (
                    <Button
                      onClick={() => setActiveTimer(assignment.id)}
                      className="w-full"
                      variant="outline"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Study Timer
                    </Button>
                  )}

                  {hasTimer && (
                    <StudyTimeTracker
                      assignmentId={assignment.id}
                      assignmentTitle={assignment.title}
                      estimatedTime={assignment.estimatedTime}
                      onTimeComplete={(minutes) => handleTimeComplete(assignment.id, minutes)}
                      onToggleMinimize={() => setActiveTimer(null)}
                    />
                  )}

                  {/* Completion Time Display */}
                  {completionTime > 0 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Time spent: {completionTime} minutes
                    </div>
                  )}

                  {/* In-Class Assignment Notice */}
                  {hasPlaceholderSubmission(assignment.id) && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex items-center gap-2 text-sm text-blue-800">
                        <CheckCircle className="h-4 w-4" />
                        <span className="font-medium">In-Class Assignment</span>
                      </div>
                      <p className="text-xs text-blue-600 mt-1">
                        This assignment was completed in class. Your teacher will grade it based on your in-class performance.
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {status === 'not_started' && completionTime > 0 && !hasPlaceholderSubmission(assignment.id) && (
                      <Button
                        onClick={() => setShowSubmissionForm(assignment.id)}
                        className="flex-1"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Submit Assignment
                      </Button>
                    )}
                    
                    <Button
                      variant="outline"
                      onClick={() => setSelectedAssignment(assignment)}
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View Details
                    </Button>
                  </div>

                  {/* Comments */}
                  {assignment.commentCount && assignment.commentCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowComments(assignment.id)}
                      className="w-full"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      {assignment.commentCount} comment{assignment.commentCount !== 1 ? 's' : ''}
                    </Button>
                  )}
                </CardContent>
              ) : (
                <CardContent className="p-3">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{assignment.description.length > 100 ? `${assignment.description.substring(0, 100)}...` : assignment.description}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleAssignmentExpansion(assignment.id)}
                      className="text-primary hover:text-primary"
                    >
                      Show More
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
            );
          } catch (error) {
            console.error('Error rendering assignment:', assignment.id, error);
            return (
              <Card key={assignment.id} className="relative border-red-200">
                <CardHeader>
                  <CardTitle className="text-lg text-red-600">Error Loading Assignment</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    There was an error loading this assignment. Please try refreshing the page.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="mt-2"
                  >
                    Refresh Page
                  </Button>
                </CardContent>
              </Card>
            );
          }
        })}
      </div>

      {/* No Assignments Message */}
      {filteredAssignments.length === 0 && (
        <Card className="text-center py-12">
          {(() => {
            if (filterStatus === "graded") {
              return (
                <>
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                  <h3 className="text-lg font-semibold mb-2">No Graded Assignments Yet</h3>
                  <p className="text-muted-foreground">
                    {studentInfo.name} hasn't received grades on any assignments yet. Keep working on them!
                  </p>
                </>
              );
            } else if (filterStatus === "submitted") {
              return (
                <>
                  <Upload className="h-12 w-12 mx-auto mb-4 text-orange-600" />
                  <h3 className="text-lg font-semibold mb-2">No Submitted Assignments</h3>
                  <p className="text-muted-foreground">
                    {studentInfo.name} hasn't submitted any assignments yet. Time to get started!
                  </p>
                </>
              );
            } else if (filterStatus === "not_started") {
              return (
                <>
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-blue-600" />
                  <h3 className="text-lg font-semibold mb-2">All Assignments Started!</h3>
                  <p className="text-muted-foreground">
                    {studentInfo.name} has started working on all available assignments. Great job!
                  </p>
                </>
              );
            } else if (filterStatus === "active") {
              return (
                <>
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Active Assignments</h3>
                  <p className="text-muted-foreground">
                    There are no active assignments at the moment.
                  </p>
                </>
              );
            } else if (filterStatus === "archived") {
              return (
                <>
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Archived Assignments</h3>
                  <p className="text-muted-foreground">
                    There are no archived assignments to show.
                  </p>
                </>
              );
            } else {
              return (
                <>
                  <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <h3 className="text-lg font-semibold mb-2">No Assignments Found</h3>
                  <p className="text-muted-foreground">
                    No assignments have been created for {studentInfo.name}'s class yet.
                  </p>
                </>
              );
            }
          })()}
        </Card>
      )}

      {/* Assignment Details Dialog */}
      <Dialog open={!!selectedAssignment} onOpenChange={() => setSelectedAssignment(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedAssignment && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAssignment.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Description</h4>
                    <p className="text-sm text-muted-foreground">
                      {selectedAssignment.description}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Details</h4>
                    <div className="space-y-1 text-sm">
                      <div>Type: {selectedAssignment.type}</div>
                      <div>Points: {selectedAssignment.points}</div>
                      <div>Estimated Time: {selectedAssignment.estimatedTime} minutes</div>
                      <div>Due: {safeDateConversion(selectedAssignment.dueDate).toLocaleDateString()}</div>
                    </div>
                  </div>
                </div>

                {selectedAssignment.attachments && selectedAssignment.attachments.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Attachments</h4>
                    <div className="space-y-2">
                      {selectedAssignment.attachments.map((attachment) => (
                        <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted rounded">
                          <File className="h-4 w-4" />
                          <span className="text-sm">{attachment.name}</span>
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <CommentSection
                  assignmentId={selectedAssignment.id}
                  comments={selectedAssignment.comments || []}
                  onCommentAdded={() => {}}
                  onCommentUpdated={() => {}}
                  onCommentDeleted={() => {}}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Submission Form Dialog */}
      <Dialog open={!!showSubmissionForm} onOpenChange={() => setShowSubmissionForm(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {showSubmissionForm && (
            <AssignmentSubmissionForm
              assignment={assignments.find(a => a.id === showSubmissionForm)!}
              studentId={studentInfo.id}
              parentId={user!.uid}
              completionTimeMinutes={completionTimes[showSubmissionForm] || 0}
              onSubmissionComplete={handleSubmissionComplete}
              onCancel={() => setShowSubmissionForm(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Comments Dialog */}
      <Dialog open={!!showComments} onOpenChange={() => setShowComments(null)}>
        <DialogContent className="max-w-2xl">
          {showComments && (
            <CommentSection
              assignmentId={showComments}
              comments={assignments.find(a => a.id === showComments)?.comments || []}
              onCommentAdded={() => {}}
              onCommentUpdated={() => {}}
              onCommentDeleted={() => {}}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
