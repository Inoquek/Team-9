import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Calendar, Clock, CheckCircle, Plus, Edit, Trash2, Eye, Users, MessageCircle, File, Download, Play, Pause, Square, Upload, X, Star, Trophy, Target, FileText, ExternalLink, TrendingUp, ChevronUp, ChevronDown } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useTeacherClass } from "@/contexts/TeacherClassContext";
import { AssignmentService, SubmissionService } from "@/lib/services/assignments";
import { StorageService } from "@/lib/services/storage";
import { Assignment, AssignmentWithComments, Comment, Submission, SubmissionFile } from "@/lib/types";
import { CommentSection } from "./CommentSection";
import { FileViewer } from "./FileViewer";
import { StudyTimeTracker } from "./StudyTimeTracker";
import { AssignmentSubmissionForm } from "./AssignmentSubmissionForm";
import { StudyTimeDashboard } from "./StudyTimeDashboard";
import { StudyTimeService } from "@/lib/services/studyTime";
import { TeacherSubmissionView } from "./TeacherSubmissionView";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, auth } from "@/lib/firebase";

// Define missing constants
const SUBJECTS = ['alphabet-time', 'vocabulary-time', 'sight-words-time', 'reading-time', 'post-programme-test'];

// Storage keys for persistence
const DAILY_STORAGE_KEY = "study_sessions_v1";
const STOPWATCH_STORAGE_KEY = "study_stopwatch_v1";
const SUBMISSIONS_STORAGE_KEY = "assignment_submissions";
const LIMIT_SECONDS = 30 * 60; // 30 minutes limit

// Types for file uploads
interface FileUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  uploadedAt: string;
}

// Types for study tracking
interface StudyEntry {
  date: string;
  minutes: number;
}

interface StopwatchState {
  running: boolean;
  startAt: number | null;
  elapsedBefore: number;
  assignmentId: string | null;
  title: string | null;
}

interface AssignmentSubmission {
  assignmentId: string;
  files: FileUpload[];
  note: string;
  submittedAt: string;
  timeSpent: number; // in seconds
}

// Helper functions
const todayISO = (): string => new Date().toISOString().split('T')[0];

const bytesToHuman = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const fileToDataURL = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Study tracking functions
const loadDaily = (): StudyEntry[] => {
  try {
    const stored = localStorage.getItem(DAILY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveDaily = (entries: StudyEntry[]): void => {
  localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(entries));
};

const addStudyMinutes = (minutes: number): void => {
  const entries = loadDaily();
  const today = todayISO();
  const todayEntry = entries.find(e => e.date === today);
  
  if (todayEntry) {
    todayEntry.minutes += minutes;
  } else {
    entries.push({ date: today, minutes });
  }
  
  saveDaily(entries);
};

const getTodayMinutes = (): number => {
  const entries = loadDaily();
  const today = todayISO();
  const todayEntry = entries.find(e => e.date === today);
  return todayEntry?.minutes || 0;
};

const getTodayCompletedAssignments = (): number => {
  try {
    const stored = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
    const submissions: AssignmentSubmission[] = stored ? JSON.parse(stored) : [];
    const today = todayISO();
    return submissions.filter(s => s.submittedAt.startsWith(today)).length;
  } catch {
    return 0;
  }
};

// Stopwatch functions
const loadStopwatch = (): StopwatchState => {
  try {
    const stored = localStorage.getItem(STOPWATCH_STORAGE_KEY);
    return stored ? JSON.parse(stored) : {
      running: false,
      startAt: null,
      elapsedBefore: 0,
      assignmentId: null,
      title: null
    };
  } catch {
    return {
      running: false,
      startAt: null,
      elapsedBefore: 0,
      assignmentId: null,
      title: null
    };
  }
};

const saveStopwatch = (state: Partial<StopwatchState>): void => {
  const current = loadStopwatch();
  const updated = { ...current, ...state };
  localStorage.setItem(STOPWATCH_STORAGE_KEY, JSON.stringify(updated));
};

interface AssignmentPageProps {
  userRole: "parent" | "teacher" | "admin";
}

export const AssignmentPage = ({ userRole }: AssignmentPageProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { selectedClass } = useTeacherClass();
  const [filterStatus, setFilterStatus] = useState("all");
  const [assignments, setAssignments] = useState<AssignmentWithComments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAssignment, setSelectedAssignment] = useState<AssignmentWithComments | null>(null);
  const [showComments, setShowComments] = useState<string | null>(null);
  
  // Existing state variables
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    subject: "",
    description: "",
    dueDate: "",
    type: "alphabet-time" as const,
    points: 10,
    estimatedTime: 30
  });

  // New state variables for the requested functionality
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todayCompletedAssignments, setTodayCompletedAssignments] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [currentAssignmentId, setCurrentAssignmentId] = useState<string | null>(null);
  const [submitDialogOpen, setSubmitDialogOpen] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([]);
  const [submissionNote, setSubmissionNote] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const [stopwatchMinimized, setStopwatchMinimized] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  
  // New state for enhanced parent functionality
  // const [showStudyDashboard, setShowStudyDashboard] = useState(false);
  const [completionTimes, setCompletionTimes] = useState<Record<string, number>>({});
  const [showSubmissionForm, setShowSubmissionForm] = useState<string | null>(null);
  const [studentInfo, setStudentInfo] = useState<{ id: string; name: string } | null>(null);
  
  // Store final stopwatch time for submissions
  const [finalStopwatchTime, setFinalStopwatchTime] = useState<Record<string, number>>({});
  
  // New state for teacher submission viewing
  const [viewingSubmissionsFor, setViewingSubmissionsFor] = useState<string | null>(null);
  
  // New state for delete confirmation
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState<string | null>(null);
  const [expandedAssignments, setExpandedAssignments] = useState<Set<string>>(new Set());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize state from localStorage
  useEffect(() => {
    setTodayMinutes(getTodayMinutes());
    setTodayCompletedAssignments(getTodayCompletedAssignments());
    
    // Restore stopwatch state
    const stopwatchState = loadStopwatch();
    if (stopwatchState.running && stopwatchState.startAt) {
      const now = Date.now();
      const elapsed = Math.floor((now - stopwatchState.startAt) / 1000);
      const totalElapsed = Math.min((stopwatchState.elapsedBefore || 0) + elapsed, LIMIT_SECONDS);
      
      setElapsedSec(totalElapsed);
      setRunning(totalElapsed < LIMIT_SECONDS);
      setCurrentAssignmentId(stopwatchState.assignmentId);
      
      // Auto-stop if limit reached
      if (totalElapsed >= LIMIT_SECONDS) {
        stopAndSave(true);
      }
    } else {
      setElapsedSec(stopwatchState.elapsedBefore || 0);
      setRunning(false);
      setCurrentAssignmentId(stopwatchState.assignmentId);
    }
  }, []);

  // Load user submissions and student data in a single effect to prevent race conditions
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return;
      
      try {
        let userSubmissions: Submission[] = [];
        
        if (userRole === 'parent') {
          // Load student info first
          const studentsQuery = query(
            collection(db, 'students'),
            where('parentId', '==', user.uid),
            where('isActive', '==', true)
          );
          const studentsSnapshot = await getDocs(studentsQuery);
          
          if (!studentsSnapshot.empty) {
            const studentDoc = studentsSnapshot.docs[0];
            const studentData = studentDoc.data();
            setStudentInfo({
              id: studentDoc.id,
              name: studentData.name
            });
            
            // Sync local study time with Firestore
            await syncStudyTimeWithFirestore();
          }
          
          // Get submissions for the current user (parent)
          console.log('Loading submissions for parent:', user.uid);
          userSubmissions = await SubmissionService.getParentSubmissions(user.uid);
          console.log('Loaded parent submissions:', userSubmissions);
          
          // Update completion times immediately
          const times: Record<string, number> = {};
          userSubmissions.forEach(sub => {
            times[sub.assignmentId] = sub.completionTimeMinutes || 0;
          });
          setCompletionTimes(times);
          console.log('Set completion times:', times);
        } else if (userRole === 'teacher') {
          // For teachers, get all submissions for their selected class
          if (selectedClass) {
            console.log('Loading submissions for teacher class:', selectedClass.id);
            
            // Get all submissions for the selected class by querying students first
            try {
              // First get all students in the class
              const studentsQuery = query(
                collection(db, 'students'),
                where('classId', '==', selectedClass.id),
                where('isActive', '==', true)
              );
              const studentsSnapshot = await getDocs(studentsQuery);
              
              if (!studentsSnapshot.empty) {
                // Get all submissions for students in this class
                // Note: Firestore 'in' queries are limited to 10 values, so we need to handle this properly
                const studentIds = studentsSnapshot.docs.map(doc => doc.id);
                console.log('Student IDs in class:', studentIds);
                
                if (studentIds.length <= 10) {
                  // If 10 or fewer students, use 'in' query
                  const submissionsQuery = query(
                    collection(db, 'submissions'),
                    where('studentId', 'in', studentIds)
                  );
                  const submissionsSnapshot = await getDocs(submissionsQuery);
                  
                  userSubmissions = submissionsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                      id: doc.id,
                      ...data,
                      submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt),
                      feedback: data.feedback ? {
                        ...data.feedback,
                        createdAt: data.feedback.createdAt?.toDate ? data.feedback.createdAt.toDate() : new Date(data.feedback.createdAt)
                      } : undefined
                    };
                  }) as Submission[];
                  
                  console.log('Loaded teacher submissions for class (in query):', userSubmissions);
                } else {
                  // If more than 10 students, we need to batch the queries
                  console.log('More than 10 students, using batch queries');
                  const allSubmissions: Submission[] = [];
                  
                  // Process students in batches of 10
                  for (let i = 0; i < studentIds.length; i += 10) {
                    const batch = studentIds.slice(i, i + 10);
                    const batchQuery = query(
                      collection(db, 'submissions'),
                      where('studentId', 'in', batch)
                    );
                    const batchSnapshot = await getDocs(batchQuery);
                    
                    const batchSubmissions = batchSnapshot.docs.map(doc => {
                      const data = doc.data();
                      return {
                        id: doc.id,
                        ...data,
                        submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt),
                        feedback: data.feedback ? {
                          ...data.feedback,
                          createdAt: data.feedback.createdAt?.toDate ? data.feedback.createdAt.toDate() : new Date(data.feedback.createdAt)
                        } : undefined
                      };
                    }) as Submission[];
                    
                    allSubmissions.push(...batchSubmissions);
                  }
                  
                  userSubmissions = allSubmissions;
                  console.log('Loaded teacher submissions for class (batch queries):', userSubmissions);
                }
              }
            } catch (error) {
              console.error('Error loading teacher submissions:', error);
            }
          }
        }
        
        setSubmissions(userSubmissions);
        console.log('Final submissions state set:', userSubmissions);
        console.log('User role:', userRole);
        console.log('Selected class:', selectedClass);
        
      } catch (error) {
        console.error('Error loading user data:', error);
        // Set empty submissions array on error to prevent undefined issues
        setSubmissions([]);
        if (userRole === 'parent') {
          setCompletionTimes({});
        }
      }
    };

    loadUserData();
  }, [user, userRole, selectedClass]); // Removed assignments dependency to prevent circular dependency

  // Debug useEffect to monitor submissions changes
  useEffect(() => {
    console.log('Submissions state changed:', submissions);
    console.log('Current user role:', userRole);
    if (userRole === 'teacher' && selectedClass) {
      console.log('Teacher view - assignments:', assignments);
      console.log('Teacher view - submissions:', submissions);
    }
  }, [submissions, userRole, selectedClass, assignments]);

  // Update daily stats when submissions are loaded (for parents)
  useEffect(() => {
    if (userRole === 'parent' && submissions.length > 0) {
      updateDailyStatsFromDatabase();
    }
  }, [submissions, userRole]);

  // Periodic refresh of daily stats for parents (every 5 minutes)
  useEffect(() => {
    if (userRole !== 'parent') return;
    
    const interval = setInterval(() => {
      updateDailyStatsFromDatabase();
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(interval);
  }, [userRole]);

  // Helper function to get submitted assignments count for parents
  const getSubmittedAssignmentsCount = () => {
    if (userRole !== 'parent') return 0;
    return submissions.length;
  };

  // Helper function to get completed assignments count for parents
  const getCompletedAssignmentsCount = () => {
    if (userRole !== 'parent') return 0;
    return submissions.filter(sub => sub.status === 'approved' || sub.status === 'completed').length;
  };

  // Helper function to get incomplete assignments count for parents
  const getIncompleteAssignmentsCount = () => {
    if (userRole !== 'parent') return 0;
    return assignments.filter(assignment => {
      const submission = findSubmissionByAssignment(assignment.id);
      return !submission || (submission.status !== 'approved' && submission.status !== 'completed');
    }).length;
  };

  // Function to update daily stats from database for parents
  const updateDailyStatsFromDatabase = async () => {
    if (userRole !== 'parent' || !studentInfo?.id) return;
    
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Get study time from database
      const studyTimeEntry = await StudyTimeService.getOrCreateStudyTimeEntry(studentInfo.id, today);
      const dbStudyTime = studyTimeEntry.totalMinutes;
      
      // Get completed assignments from database (submissions made today)
      const todaySubmissions = submissions.filter(sub => {
        const submissionDate = new Date(sub.submittedAt).toISOString().split('T')[0];
        return submissionDate === today && (sub.status === 'approved' || sub.status === 'completed');
      });
      const dbCompletedCount = todaySubmissions.length;
      
      // Update state with database values
      setTodayMinutes(dbStudyTime);
      setTodayCompletedAssignments(dbCompletedCount);
      
      console.log(`Updated daily stats from database: ${dbStudyTime}m study time, ${dbCompletedCount} completed assignments`);
      console.log('Study time entry details:', studyTimeEntry);
      console.log('Today submissions:', todaySubmissions);
      console.log('Document ID being queried:', `${studentInfo.id}_${today}`);
      console.log('Raw study time value from database:', dbStudyTime, 'Type:', typeof dbStudyTime);
    } catch (error) {
      console.error('Error updating daily stats from database:', error);
      // Fallback to local storage values if database fails
      setTodayMinutes(getTodayMinutes());
      setTodayCompletedAssignments(getTodayCompletedAssignments());
    }
  };

  // Helper function to find submission by assignment ID
  const findSubmissionByAssignment = (assignmentId: string): Submission | undefined => {
    const submission = submissions.find(sub => sub.assignmentId === assignmentId);
    console.log(`Looking for submission for assignment ${assignmentId}:`, submission);
    console.log('All submissions:', submissions);
    return submission;
  };

  // Helper function to get submission count for a specific assignment
  const getSubmissionCountForAssignment = (assignmentId: string): number => {
    const count = submissions.filter(sub => sub.assignmentId === assignmentId).length;
    console.log(`Submission count for assignment ${assignmentId}: ${count}`);
    console.log('All submissions:', submissions);
    console.log('Submissions for this assignment:', submissions.filter(sub => sub.assignmentId === assignmentId));
    return count;
  };

  // Helper functions for submission status display
  const getSubmissionStatusColor = (status: string) => {
    switch (status) {
      case 'approved': 
      case 'completed': return 'success';
      case 'submitted':
      case 'pending': return 'warning';
      case 'needsRevision': return 'destructive';
      case 'not_started': return 'secondary';
      default: return 'secondary';
    }
  };

  const getSubmissionStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': 
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'submitted': return <Upload className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'needsRevision': return <Target className="h-4 w-4" />;
      case 'not_started': return <BookOpen className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  const getSubmissionStatusText = (status: string) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'completed': return 'Completed';
      case 'submitted': return 'Submitted';
      case 'pending': return 'Pending';
      case 'needsRevision': return 'Needs Revision';
      case 'not_started': return 'Not Started';
      default: return 'Unknown';
    }
  };

  // Safe rendering function for feedback
  const renderFeedback = (feedback: any) => {
    if (!feedback || typeof feedback !== 'object') return null;
    
    return (
      <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <div className="flex items-center mb-1">
          <MessageCircle className="w-4 w-4 text-blue-600 mr-1" />
          <span className="text-sm font-medium text-blue-800">Teacher Feedback</span>
        </div>
        <div className="space-y-2">
          {feedback.message && (
            <p className="text-sm text-blue-700">{feedback.message}</p>
          )}
          {feedback.emoji && (
            <p className="text-2xl">{feedback.emoji}</p>
          )}
          {feedback.points !== undefined && (
            <p className="text-sm text-blue-600 font-medium">
              Points: {feedback.points}
            </p>
          )}
          {feedback.createdAt && (
            <p className="text-xs text-blue-500">
              {feedback.createdAt instanceof Date 
                ? feedback.createdAt.toLocaleDateString()
                : new Date(feedback.createdAt).toLocaleDateString()
              }
            </p>
          )}
        </div>
      </div>
    );
  };



  // Function to sync local study time with Firestore
  const syncStudyTimeWithFirestore = async () => {
    if (userRole === 'parent' && studentInfo?.id) {
      try {
        const today = new Date().toISOString().split('T')[0];
        const localMinutes = getTodayMinutes();
        
        if (localMinutes > 0) {
          // Get current study time from Firestore
          const studyTimeEntry = await StudyTimeService.getOrCreateStudyTimeEntry(studentInfo.id, today);
          const firestoreMinutes = studyTimeEntry.totalMinutes;
          
          // If local time is greater than Firestore time, update Firestore
          if (localMinutes > firestoreMinutes) {
            const minutesToAdd = localMinutes - firestoreMinutes;
            await StudyTimeService.addStudyTime(studentInfo.id, today, minutesToAdd);
            console.log(`Synced local study time with Firestore: added ${minutesToAdd} minutes`);
          }
        }
      } catch (error) {
        console.error('Error syncing study time with Firestore:', error);
      }
    }
  };

  // Function to update study time in Firestore periodically
  const updateStudyTimeInFirestore = async (minutes: number) => {
    if (userRole === 'parent' && studentInfo?.id && minutes > 0) {
      try {
        const today = new Date().toISOString().split('T')[0];
        await StudyTimeService.addStudyTime(studentInfo.id, today, minutes);
        console.log(`Updated study time in Firestore: ${minutes} minutes for student ${studentInfo.id}`);
      } catch (error) {
        console.error('Error updating study time in Firestore:', error);
      }
    }
  };

  // Stopwatch interval
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        const stopwatchState = loadStopwatch();
        if (stopwatchState.running && stopwatchState.startAt) {
          const now = Date.now();
          const elapsed = Math.floor((now - stopwatchState.startAt) / 1000);
          const totalElapsed = Math.min((stopwatchState.elapsedBefore || 0) + elapsed, LIMIT_SECONDS);
          
          setElapsedSec(totalElapsed);
          
          // Update study time in Firestore every 5 minutes (300 seconds)
          if (totalElapsed > 0 && totalElapsed % 300 === 0) {
            const minutesToAdd = 5; // 5 minutes
            updateStudyTimeInFirestore(minutesToAdd);
          }
          
          // Auto-stop at limit
          if (totalElapsed >= LIMIT_SECONDS) {
            stopAndSave(true);
          }
        }
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [running]);

  // Stopwatch functions
  const startStopwatch = async (assignment: AssignmentWithComments) => {
    const state = loadStopwatch();
    
    // If already running for this assignment, just return
    if (state.running && state.assignmentId === assignment.id) {
      return;
    }
    
    // Stop any existing session first
    if (state.running) {
      await stopAndSave(true);
    }
    
    // Start new session
    saveStopwatch({
      running: true,
      startAt: Date.now(),
      elapsedBefore: 0,
      assignmentId: assignment.id,
      title: assignment.title
    });
    
    setRunning(true);
    setElapsedSec(0);
    setCurrentAssignmentId(assignment.id);
    setStopwatchMinimized(false); // Show dialog when starting
    
    toast({
      title: "Timer Started",
      description: `Started working on "${assignment.title}"`,
    });
  };

  const togglePause = async () => {
    const state = loadStopwatch();
    
    if (running) {
      // Pause
      const now = Date.now();
      const extra = state.startAt ? Math.floor((now - state.startAt) / 1000) : 0;
      const nextElapsed = Math.min((state.elapsedBefore || 0) + extra, LIMIT_SECONDS);
      
      saveStopwatch({
        running: false,
        startAt: null,
        elapsedBefore: nextElapsed
      });
      
      setElapsedSec(nextElapsed);
      setRunning(false);
    } else {
      // Resume
      if ((state.elapsedBefore || 0) >= LIMIT_SECONDS) return;
      
      saveStopwatch({
        running: true,
        startAt: Date.now()
      });
      
      setRunning(true);
    }
  };

  const stopAndSave = async (isAuto: boolean = false) => {
    const state = loadStopwatch();
    const now = Date.now();
    const extra = state.running && state.startAt ? Math.floor((now - state.startAt) / 1000) : 0;
    const finalSec = Math.min((state.elapsedBefore || 0) + extra, LIMIT_SECONDS);
    
    // Store the final time for this assignment before clearing
    if (state.assignmentId && finalSec > 0) {
      setFinalStopwatchTime(prev => ({
        ...prev,
        [state.assignmentId]: finalSec
      }));
      console.log(`Stored final time for assignment ${state.assignmentId}: ${finalSec} seconds`);
    }
    
    // Clear stopwatch state
    saveStopwatch({
      running: false,
      startAt: null,
      elapsedBefore: 0,
      assignmentId: null,
      title: null
    });
    
    setRunning(false);
    setElapsedSec(0);
    setCurrentAssignmentId(null);
    setStopwatchMinimized(false); // Reset minimized state
    
    // Add minutes to daily total
    const minutes = Math.floor(finalSec / 60);
    if (minutes > 0) {
      addStudyMinutes(minutes);
      setTodayMinutes(getTodayMinutes());
      
      // Also update study time in Firestore for the student
      if (userRole === 'parent' && studentInfo?.id) {
        try {
          const today = new Date().toISOString().split('T')[0];
          await StudyTimeService.addStudyTime(studentInfo.id, today, minutes);
          console.log(`Added ${minutes} minutes to study time for student ${studentInfo.id}`);
          
          // Update daily stats after study time update
          updateDailyStatsFromDatabase();
        } catch (error) {
          console.error('Error updating study time in Firestore:', error);
          toast({
            title: "Warning",
            description: "Study time saved locally but failed to sync with server.",
            variant: "destructive"
          });
        }
      }
    }
    
    if (!isAuto) {
      toast({
        title: "Timer Stopped",
        description: `Session completed! ${minutes} minutes added to your daily total.`,
      });
    }
  };

  // File upload functions
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newFiles: FileUpload[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Check file size (2MB limit)
        if (file.size > 2 * 1024 * 1024) {
          toast({
            title: "File too large",
            description: `${file.name} exceeds the 2MB size limit.`,
            variant: "destructive"
          });
          continue;
        }

        // Check total files limit
        if (uploadedFiles.length + newFiles.length >= 3) {
          toast({
            title: "Too many files",
            description: "You can upload a maximum of 3 files.",
            variant: "destructive"
          });
          break;
        }

        const dataUrl = await fileToDataURL(file);
        const fileUpload: FileUpload = {
          id: crypto.randomUUID(),
          name: file.name,
          type: file.type,
          size: file.size,
          dataUrl,
          uploadedAt: new Date().toISOString()
        };

        newFiles.push(fileUpload);
      }

      setUploadedFiles(prev => [...prev, ...newFiles]);
      
      if (newFiles.length > 0) {
        toast({
          title: "Files uploaded",
          description: `${newFiles.length} file(s) uploaded successfully.`,
        });
      }
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload some files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const openSubmitDialog = (assignmentId: string) => {
    setSubmitDialogOpen(assignmentId);
    setUploadedFiles([]);
    setSubmissionNote("");
  };

  const submitAssignment = async (assignmentId: string) => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No files",
        description: "Please upload at least one file before submitting.",
        variant: "destructive"
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please log in to submit assignments.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsUploading(true);

      // Get time spent on this assignment from stored final time
      const storedTime = finalStopwatchTime[assignmentId] || 0;
      let timeSpent = storedTime > 0 ? storedTime : 0;
      
      // Fallback: if no stored time, check if timer is currently running for this assignment
      if (timeSpent === 0 && currentAssignmentId === assignmentId && running) {
        const currentState = loadStopwatch();
        if (currentState.assignmentId === assignmentId) {
          const now = Date.now();
          const extra = currentState.startAt ? Math.floor((now - currentState.startAt) / 1000) : 0;
          timeSpent = Math.min((currentState.elapsedBefore || 0) + extra, LIMIT_SECONDS);
          console.log(`Using current running timer time: ${timeSpent} seconds`);
        }
      }
      
      console.log(`Final time spent for assignment ${assignmentId}: ${timeSpent} seconds`);

      // Upload files to Firebase Storage
      const uploadedSubmissionFiles: SubmissionFile[] = [];
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        const file = uploadedFiles[i];
        
        // Convert dataUrl back to Blob
        const response = await fetch(file.dataUrl);
        const blob = await response.blob();
        
        // Create upload path: submissions/{assignmentId}/{userId}/{timestamp}_{filename}
        const timestamp = Date.now();
        const uploadPath = `submissions/${assignmentId}/${user.uid}/${timestamp}_${file.name}`;
        
        try {
          // Upload blob directly to storage
          const storageRef = ref(storage, uploadPath);
          const snapshot = await uploadBytes(storageRef, blob, {
            contentType: file.type,
            customMetadata: {
              assignmentId: assignmentId,
              originalName: file.name,
              uploadedBy: user.uid,
              submissionNote: submissionNote
            }
          });
          
          const downloadUrl = await getDownloadURL(snapshot.ref);
          
          const submissionFile: SubmissionFile = {
            id: crypto.randomUUID(),
            type: file.type.startsWith('image/') ? 'image' : 
                  file.type.startsWith('video/') ? 'video' : 
                  file.type.startsWith('audio/') ? 'audio' : 'image', // Default to image for other types
            url: downloadUrl,
            filename: file.name,
            size: file.size,
            uploadedAt: new Date()
          };
          
          uploadedSubmissionFiles.push(submissionFile);
        } catch (uploadError) {
          console.error(`Error uploading file ${file.name}:`, uploadError);
          throw new Error(`Failed to upload ${file.name}`);
        }
      }

      // Create submission object
      const submissionData = {
        assignmentId,
        studentId: studentInfo?.id || user.uid, // Use actual student ID if available
        parentId: user.uid,
        files: uploadedSubmissionFiles,
        completionTimeMinutes: Math.ceil(timeSpent / 60), // Convert seconds to minutes
        studyTimeToday: 0, // Will be updated by StudyTimeService
        status: 'completed' as const // Mark as completed for the parent
      };

      // Save submission to Firestore
      console.log('Attempting to save submission:', submissionData);
      console.log('User authenticated:', !!user, 'User ID:', user?.uid, 'User role:', user?.role);
      console.log('Firebase user:', auth.currentUser?.uid);
      console.log('Student info:', studentInfo);
      console.log('Student ID being used:', studentInfo?.id || user.uid);
      
      // Ensure user has a role for demo purposes - temporary fix
      if (!user?.role) {
        console.warn('User role not set, assuming parent role for submission');
        // Don't throw error, just log warning and continue with parent role assumption
      }
      
      const submissionId = await SubmissionService.submitHomework(submissionData);

      // Update study time
      try {
        if (studentInfo?.id) {
          const today = new Date().toISOString().split('T')[0];
          await StudyTimeService.addStudyTime(studentInfo.id, today, Math.ceil(timeSpent / 60));
          
          // Update daily stats after study time update
          if (userRole === 'parent') {
            updateDailyStatsFromDatabase();
          }
        }
      } catch (studyTimeError) {
        console.warn('Could not update study time:', studyTimeError);
      }

      // Note: We no longer change assignment status to prevent assignments from disappearing
      // The assignment remains visible to parents even after submission

      // Update local submissions state
      const newSubmission: Submission = {
        id: submissionId,
        assignmentId,
        studentId: studentInfo?.id || user.uid, // Use actual student ID if available
        parentId: user.uid,
        files: uploadedSubmissionFiles,
        submittedAt: new Date(),
        status: 'completed' as const, // Mark as completed for the parent
        points: 0,
        completionTimeMinutes: Math.ceil(timeSpent / 60),
        studyTimeToday: 0
      };

      setSubmissions(prev => [newSubmission, ...prev]);
      
      // Update daily stats after successful submission
      if (userRole === 'parent') {
        console.log('Updating daily stats after submission...');
        updateDailyStatsFromDatabase();
      }
      
      // Clear the stored final time for this assignment
      setFinalStopwatchTime(prev => {
        const { [assignmentId]: removed, ...rest } = prev;
        console.log(`Cleared stored time for assignment ${assignmentId}`);
        return rest;
      });
      
      // Store locally as backup
      try {
        const stored = localStorage.getItem(SUBMISSIONS_STORAGE_KEY);
        const localSubmissions: AssignmentSubmission[] = stored ? JSON.parse(stored) : [];
        localSubmissions.push({
          assignmentId,
          files: uploadedFiles,
          note: submissionNote,
          submittedAt: new Date().toISOString(),
          timeSpent
        });
        localStorage.setItem(SUBMISSIONS_STORAGE_KEY, JSON.stringify(localSubmissions));
      } catch (storageError) {
        console.warn('Could not save to localStorage:', storageError);
      }

      setSubmitDialogOpen(null);
      setUploadedFiles([]);
      setSubmissionNote("");

      toast({
        title: "Assignment completed successfully!",
        description: "Your work has been uploaded and marked as completed.",
      });

    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast({
        title: "Submission failed", 
        description: error instanceof Error ? error.message : "Failed to submit assignment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  };



  // Add missing functions
  const openCreate = () => {
    setEditingId(null);
    setDraft({
      title: "",
      subject: "",
      description: "",
      dueDate: "",
      type: "alphabet-time",
      points: 10,
      estimatedTime: 30
    });
    setIsAssignDialogOpen(true);
  };

  const upsertAssignment = async () => {
    if (!user || !draft.title || !draft.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    try {
      if (editingId) {
        // Update existing assignment
        await AssignmentService.updateAssignment(editingId, {
          title: draft.title,
          description: draft.description,
          dueDate: new Date(draft.dueDate),
          points: draft.points,
          estimatedTime: draft.estimatedTime
        });
        toast({
          title: "Success",
          description: "Assignment updated successfully.",
        });
      } else {
        // Create new assignment
        // Note: This would need a classId, which should come from context or props
        // For now, we'll show an error
        toast({
          title: "Error",
          description: "Class ID is required to create assignments.",
          variant: "destructive"
        });
        return;
      }
      
      setIsAssignDialogOpen(false);
      setEditingId(null);
      // Reload assignments
      window.location.reload();
    } catch (error) {
      console.error('Error upserting assignment:', error);
      toast({
        title: "Error",
        description: "Failed to save assignment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const markComplete = async (assignmentId: string) => {
    try {
      // This would need to be implemented based on your requirements
      // For now, we'll just show a toast
      toast({
        title: "Success",
        description: "Assignment marked as complete.",
      });
    } catch (error) {
      console.error('Error marking assignment complete:', error);
      toast({
        title: "Error",
        description: "Failed to mark assignment complete. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Load assignments based on user role
  useEffect(() => {
    const loadAssignments = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const assignmentsData: AssignmentWithComments[] = [];
        
        if (user.role === 'teacher') {
          // For teachers, get assignments from their selected class only
          if (selectedClass) {
            try {
              console.log(`Loading assignments for selected class: ${selectedClass.name} (${selectedClass.id})`);
              const classAssignments = await AssignmentService.getClassAssignmentsWithComments(selectedClass.id);
              assignmentsData.push(...classAssignments);
              console.log(`Loaded ${classAssignments.length} assignments for class ${selectedClass.name}`);
            } catch (error) {
              console.error('Error loading teacher assignments for selected class:', error);
            }
          } else {
            console.log('No class selected, loading assignments from all classes');
            // Fallback: get assignments from all teacher's classes if no class is selected
            try {
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
              console.error('Error loading teacher assignments from all classes:', error);
            }
          }
        } else if (user.role === 'parent') {
          // For parents, get assignments from their child's class using the new method
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
                // Use the new method that includes all statuses for parents
                const classAssignments = await AssignmentService.getClassAssignmentsForParents(studentData.classId);
                // Add comments to each assignment
                const assignmentsWithComments = await Promise.all(
                  classAssignments.map(async (assignment) => {
                    try {
                      const comments = await AssignmentService.getAssignmentComments(assignment.id);
                      return {
                        ...assignment,
                        comments,
                        commentCount: comments.length
                      };
                    } catch (error) {
                      console.error(`Error loading comments for assignment ${assignment.id}:`, error);
                      return {
                        ...assignment,
                        comments: [],
                        commentCount: 0
                      };
                    }
                  })
                );
                assignmentsData.push(...assignmentsWithComments);
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
  }, [user, toast, selectedClass]);

  const filteredAssignments = assignments.filter(assignment => {
    if (filterStatus === "all") return true;
    
    // For parents, filter based on submission status, not assignment status
    if (userRole === "parent") {
      const submission = findSubmissionByAssignment(assignment.id);
      
      if (filterStatus === "incomplete") {
        // Show assignments that are not completed from submission perspective
        return !submission || (submission.status !== 'approved' && submission.status !== 'completed');
      }
      if (filterStatus === "completed") {
        // Show assignments that are completed from submission perspective
        return submission && (submission.status === 'approved' || submission.status === 'completed');
      }
      if (filterStatus === "active") {
        // Show active assignments (not archived)
        return assignment.status === "active";
      }
      if (filterStatus === "archived") {
        // Show archived assignments
        return assignment.status === "archived";
      }
      return true;
    }
    
    // For teachers/admins, filter based on assignment status
    if (filterStatus === "incomplete") {
      // Show assignments that are not completed (active, pending, etc.)
      return assignment.status !== "completed" && assignment.status !== "archived";
    }
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
      // Delete comment in database
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

  // New handler functions for enhanced parent functionality
  const handleTimeComplete = (assignmentId: string, minutes: number) => {
    setCompletionTimes(prev => ({ ...prev, [assignmentId]: minutes }));
    setCurrentAssignmentId(null);
    
    toast({
      title: "Time tracked!",
      description: `You spent ${minutes} minutes on this assignment.`,
    });
  };

  // Refresh assignments when submissions change
  const handleSubmissionComplete = (submissionId: string) => {
    setShowSubmissionForm(null);
    
    // Refresh submissions and check for existing ones
    const refreshSubmissions = async () => {
      try {
        let userSubmissions: Submission[] = [];
        
        if (userRole === 'parent') {
          // For parents, get their own submissions
          userSubmissions = await SubmissionService.getParentSubmissions(user!.uid);
          
          // Update completion times
          const times: Record<string, number> = {};
          userSubmissions.forEach(sub => {
            times[sub.assignmentId] = sub.completionTimeMinutes || 0;
          });
          setCompletionTimes(times);
        } else if (userRole === 'teacher' && selectedClass) {
          // For teachers, get all submissions for their selected class
          const submissionsQuery = query(
            collection(db, 'submissions'),
            where('assignmentId', 'in', assignments.map(a => a.id))
          );
          const submissionsSnapshot = await getDocs(submissionsQuery);
          
          userSubmissions = submissionsSnapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt),
              feedback: data.feedback ? {
                ...data.feedback,
                createdAt: data.feedback.createdAt?.toDate ? data.feedback.createdAt.toDate() : new Date(data.feedback.createdAt)
              } : undefined
            };
          }) as Submission[];
        }
        
        setSubmissions(userSubmissions);
      } catch (error) {
        console.error('Error refreshing submissions:', error);
      }
    };
    
    refreshSubmissions();
  };

  // Delete assignment function
  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!user || (userRole !== 'teacher' && userRole !== 'admin')) {
      toast({
        title: "Error",
        description: "You don't have permission to delete assignments.",
        variant: "destructive"
      });
      return;
    }

    try {
      await AssignmentService.deleteAssignment(assignmentId);
      
      // Update local state
      setAssignments(prev => prev.filter(assignment => assignment.id !== assignmentId));
      
      setDeleteConfirmOpen(null);
      toast({
        title: "Success",
        description: "Assignment deleted successfully.",
      });
    } catch (error) {
      console.error('Error deleting assignment:', error);
      toast({
        title: "Error",
        description: "Failed to delete assignment. Please try again.",
        variant: "destructive"
      });
    }
  };



  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "success";
      case "completed": return "default";
      case "archived": return "secondary";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active": return <CheckCircle className="h-4 w-4" />;
      case "completed": return <CheckCircle className="h-4 w-4" />;
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

  const formatDueDate = (dueDate: Date | string | { toDate: () => Date } | null | undefined) => {
    try {
      // Handle Firestore Timestamp
      if (dueDate && typeof dueDate === 'object' && 'toDate' in dueDate && typeof dueDate.toDate === 'function') {
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

  // Show TeacherSubmissionView if viewing submissions
  if (viewingSubmissionsFor) {
    return (
      <TeacherSubmissionView
        assignmentId={viewingSubmissionsFor}
        onBack={() => setViewingSubmissionsFor(null)}
      />
    );
  }

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
      {/* Daily Stats Board - Only for parents */}
      {userRole === "parent" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Study Time Today</p>
                  <p className="text-3xl font-bold">{todayMinutes}m</p>
                  {/* Debug info - remove in production */}
                  <p className="text-xs text-blue-200">Debug: {JSON.stringify({ todayMinutes, userRole, studentInfo: studentInfo?.id })}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Completed Today</p>
                  <p className="text-3xl font-bold">{todayCompletedAssignments}</p>
                </div>
                <Trophy className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {userRole === "parent" ? "Student Assignments" : "Class Assignments"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {userRole === "parent" ? "Upload your child's work, view grades, and chat with teachers" : "Manage, review, grade, and message parents"}
          </p>
          {userRole === "teacher" && selectedClass && (
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="secondary" className="text-sm">
                {selectedClass.name} (Grade {selectedClass.grade})
              </Badge>
              <span className="text-xs text-muted-foreground">
                {selectedClass.studentCount} students
              </span>
            </div>
          )}
          {userRole === "teacher" && !selectedClass && (
            <div className="mt-2">
              <Badge variant="outline" className="text-sm">
                No class selected - showing assignments from all classes
              </Badge>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-3">
        
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="incomplete">Incomplete</SelectItem>
              {userRole === "parent" && (
                <SelectItem value="completed">Completed</SelectItem>
              )}
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          {/* Removed New Assignment button */}
        </div>
      </div>

      

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  {userRole === "parent" 
                    ? getCompletedAssignmentsCount() // Show completed assignments count for parents
                    : assignments.filter(a => a.status === "active").length // Show active assignments for teachers/admins
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {userRole === "parent" ? "Completed" : "Active"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {userRole === "parent" ? (
          // For parents, show incomplete assignments count
          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Target className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-2xl font-bold">
                    {getIncompleteAssignmentsCount()}
                  </p>
                  <p className="text-sm text-muted-foreground">Incomplete</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          // For teachers/admins, show total comments
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
        )}

        {/* Removed Active Rate card */}
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
                      
                      {/* Assignment Type with Icon */}
                      <Badge variant="outline" className="flex items-center space-x-1">
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
                      
                      {/* Assignment Status */}
                      {userRole === "parent" ? (
                        // For parents, show submission status instead of assignment status
                        (() => {
                          const submission = findSubmissionByAssignment(assignment.id);
                          if (!submission) {
                            return (
                              <Badge variant="secondary" className="flex items-center space-x-1">
                                <BookOpen className="h-4 w-4" />
                                <span>Not Started</span>
                              </Badge>
                            );
                          }
                          
                          const statusColor = getSubmissionStatusColor(submission.status);
                          const statusIcon = getSubmissionStatusIcon(submission.status);
                          const statusText = getSubmissionStatusText(submission.status);
                          
                          return (
                            <Badge variant={statusColor} className="flex items-center space-x-1">
                              {statusIcon}
                              <span>{statusText}</span>
                            </Badge>
                          );
                        })()
                      ) : (
                        // For teachers/admins, show assignment status
                        <Badge variant={getStatusColor(assignment.status)} className="flex items-center space-x-1">
                          {getStatusIcon(assignment.status)}
                          <span className="capitalize">{assignment.status}</span>
                        </Badge>
                      )}
                      
                      {/* Show submissions count for teachers */}
                      {userRole === "teacher" && (
                        <>
                          <Badge 
                            variant={getSubmissionCountForAssignment(assignment.id) > 0 ? "default" : "outline"} 
                            className={`flex items-center space-x-1 ${
                              getSubmissionCountForAssignment(assignment.id) > 0 
                                ? 'bg-green-100 text-green-700 border-green-200' 
                                : 'bg-gray-100 text-gray-500 border-gray-200'
                            }`}
                          >
                            <FileText className="h-4 w-4" />
                            <span>
                              {getSubmissionCountForAssignment(assignment.id)} submission{getSubmissionCountForAssignment(assignment.id) !== 1 ? 's' : ''}
                            </span>
                          </Badge>
                        </>
                      )}
                    </div>
                                         <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                       <div className="flex items-center space-x-1">
                         <Calendar className="h-4 w-4" />
                         <span>Due: {formatDueDate(assignment.dueDate)}</span>
                       </div>
                      
                      {/* Due Date Status Badge */}
                      {(() => {
                        const now = new Date();
                        const dueDate = new Date(assignment.dueDate);
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
                      
                      <div className="flex items-center space-x-1">
                        <MessageCircle className="h-4 w-4" />
                        <span>{assignment.commentCount || 0} comments</span>
                      </div>
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
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowComments(showComments === assignment.id ? null : assignment.id)}
                      title="Comments"
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedAssignment(assignment)}
                      title="Preview Assignment"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {/* View Submissions button for teachers and admins */}
                    {(userRole === "teacher" || userRole === "admin") && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingSubmissionsFor(assignment.id)}
                        title="View Submissions"
                      >
                        <FileText className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Delete button for teachers and admins */}
                    {(userRole === "teacher" || userRole === "admin") && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            title="Delete Assignment"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Assignment</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{assignment.title}"? This action cannot be undone and will remove all associated submissions and comments.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteAssignment(assignment.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardHeader>
              
              {/* Collapsible Content */}
              {expandedAssignments.has(assignment.id) ? (
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{assignment.description}</p>
                
                {/* Time Spent Display */}
                {userRole === "parent" && currentAssignmentId === assignment.id && elapsedSec > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-blue-700">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Time spent: {Math.floor(elapsedSec / 60)}m {elapsedSec % 60}s
                      </span>
                    </div>
                  </div>
                )}



                {/* Parent Action Buttons */}
                {userRole === "parent" && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    {/* Check if assignment is already completed for this parent */}
                    {findSubmissionByAssignment(assignment.id) ? (
                      // Assignment completed - show completion status
                      <div className="flex-1 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-center gap-2 text-green-700">
                          <CheckCircle className="h-5 w-5" />
                          <span className="font-medium">Assignment Completed</span>
                        </div>
                        <p className="text-sm text-green-600 mt-1">
                          Completed on {new Date(findSubmissionByAssignment(assignment.id)?.submittedAt || new Date()).toLocaleDateString()}
                        </p>
                      </div>
                    ) : (
                      // Assignment not completed - show action buttons
                      <>
                        <Dialog open={currentAssignmentId === assignment.id && running && !stopwatchMinimized} onOpenChange={(open) => {
                          if (!open && running && currentAssignmentId === assignment.id) {
                            // Minimize to floating widget instead of closing
                            setStopwatchMinimized(true);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              onClick={() => {
                                if (running && currentAssignmentId === assignment.id) {
                                  // If timer is running for this assignment, show the dialog
                                  setStopwatchMinimized(false);
                                } else {
                                  // Start the timer
                                  startStopwatch(assignment);
                                  setStopwatchMinimized(false);
                                }
                              }}
                              disabled={running && currentAssignmentId !== assignment.id}
                              className="flex-1"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              {running && currentAssignmentId === assignment.id ? "View Timer" : "Start Assignment"}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Working on: {assignment.title}</DialogTitle>
                            </DialogHeader>
                            <div className="flex flex-col items-center py-8">
                              <div className="text-6xl font-mono font-bold mb-6">
                                {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:
                                {String(elapsedSec % 60).padStart(2, '0')}
                              </div>
                              
                              <div className="flex gap-3 mb-4">
                                <Button onClick={togglePause} variant={running ? "secondary" : "default"}>
                                  {running ? (
                                    <>
                                      <Pause className="h-4 w-4 mr-2" />
                                      Pause
                                    </>
                                  ) : (
                                    <>
                                      <Play className="h-4 w-4 mr-2" />
                                      Resume
                                    </>
                                  )}
                                </Button>
                                <Button variant="outline" onClick={() => setStopwatchMinimized(true)}>
                                  Minimize
                                </Button>
                                <Button variant="destructive" onClick={() => stopAndSave(false)}>
                                  <Square className="h-4 w-4 mr-2" />
                                  Done
                                </Button>
                              </div>
                              
                              <Progress 
                                value={(elapsedSec / LIMIT_SECONDS) * 100} 
                                className="w-full mb-2" 
                              />
                              <p className="text-xs text-muted-foreground text-center">
                                Limit: {LIMIT_SECONDS / 60} minutes • Time will be added to your daily total when you stop
                              </p>
                            </div>
                          </DialogContent>
                        </Dialog>
                        
                        <Dialog open={submitDialogOpen === assignment.id} onOpenChange={(open) => {
                          if (open) {
                            openSubmitDialog(assignment.id);
                          } else {
                            setSubmitDialogOpen(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button variant="secondary" className="flex-1">
                              <Upload className="h-4 w-4 mr-2" />
                              Submit Assignment
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Submit: {assignment.title}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="submission-note">Note (optional)</Label>
                                <Textarea
                                  id="submission-note"
                                  rows={3}
                                  value={submissionNote}
                                  onChange={(e) => setSubmissionNote(e.target.value)}
                                  placeholder="Add a note for your teacher..."
                                />
                              </div>
                              
                              <div>
                                <Label>Upload Files (PDF or Images, max 2MB each, up to 3 files)</Label>
                                <div 
                                  className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition"
                                  onClick={() => fileInputRef.current?.click()}
                                >
                                  <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                                  <p className="text-sm text-muted-foreground">
                                    Click to upload files
                                  </p>
                                  <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    onChange={handleFileChange}
                                    className="hidden"
                                  />
                                </div>
                              </div>

                              {/* Uploaded Files */}
                              {uploadedFiles.length > 0 && (
                                <div className="space-y-2">
                                  <Label>Uploaded Files:</Label>
                                  {uploadedFiles.map((file) => (
                                    <div key={file.id} className="flex items-center justify-between bg-muted rounded p-2">
                                      <div className="flex items-center gap-2">
                                        <File className="h-4 w-4" />
                                        <div>
                                          <p className="text-sm font-medium">{file.name}</p>
                                          <p className="text-xs text-muted-foreground">{bytesToHuman(file.size)}</p>
                                        </div>
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removeFile(file.id)}
                                      >
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  onClick={() => setSubmitDialogOpen(null)}
                                  className="flex-1"
                                >
                                  Cancel
                                </Button>
                                <Button 
                                  onClick={() => submitAssignment(assignment.id)}
                                  disabled={uploadedFiles.length === 0 || isUploading}
                                  className="flex-1"
                                >
                                  {isUploading ? "Uploading..." : "Submit"}
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </>
                    )}
                  </div>
                )}

                {/* My Submission - Only for parents */}
                {userRole === "parent" && findSubmissionByAssignment(assignment.id) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-green-800 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Your Completed Assignment
                      </h4>
                      <Badge variant="secondary" className="text-green-700 bg-green-100">
                        Completed
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-green-700">
                        Completed: {new Date(findSubmissionByAssignment(assignment.id)?.submittedAt || new Date()).toLocaleString()}
                      </p>
                      <p className="text-sm text-green-600">
                        Time spent: {findSubmissionByAssignment(assignment.id)?.completionTimeMinutes || 0} minutes
                      </p>
                      
                      {findSubmissionByAssignment(assignment.id)?.files.length! > 0 && (
                        <div>
                          <p className="text-sm font-medium text-green-800 mb-2">Uploaded Files:</p>
                          <div className="space-y-1">
                            {findSubmissionByAssignment(assignment.id)?.files.map((file, index) => (
                              <div key={index} className="flex items-center justify-between bg-white rounded p-2 border">
                                <div className="flex items-center gap-2">
                                  <File className="h-4 w-4 text-green-600" />
                                  <span className="text-sm">{file.filename}</span>
                                  <span className="text-xs text-muted-foreground">
                                    ({bytesToHuman(file.size)})
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(file.url, '_blank')}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  View
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {findSubmissionByAssignment(assignment.id)?.feedback && (
                        <div className="bg-blue-50 border border-blue-200 rounded p-3 mt-3">
                          <h5 className="font-medium text-blue-800 mb-2">Teacher Feedback:</h5>
                          {renderFeedback(findSubmissionByAssignment(assignment.id)?.feedback)}
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                  <div className="flex items-center space-x-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span>Points: {assignment.points}</span>
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
          ))}
        </div>
      ) : (
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

      {/* New Assignment Submission Form Dialog for Parents */}
      {userRole === "parent" && (
        <Dialog open={!!showSubmissionForm} onOpenChange={() => setShowSubmissionForm(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            {showSubmissionForm && (
              <AssignmentSubmissionForm
                assignment={assignments.find(a => a.id === showSubmissionForm)!}
                studentId={studentInfo?.id || user!.uid}
                parentId={user!.uid}
                completionTimeMinutes={completionTimes[showSubmissionForm] || 0}
                onSubmissionComplete={handleSubmissionComplete}
                onCancel={() => setShowSubmissionForm(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Floating Stopwatch Widget */}
      {userRole === "parent" && (running || elapsedSec > 0) && stopwatchMinimized && (
        <div className="fixed bottom-4 right-4 z-50">
          <Card className="shadow-lg border-2 border-primary/20 cursor-pointer hover:scale-105 transition-transform">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div 
                  className="text-center cursor-pointer"
                  onClick={() => setStopwatchMinimized(false)}
                >
                  <div className="font-mono text-lg font-bold">
                    {String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:
                    {String(elapsedSec % 60).padStart(2, '0')}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Math.floor(elapsedSec / 60)}/{LIMIT_SECONDS / 60}m
                  </div>
                </div>
                
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={togglePause}>
                    {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => stopAndSave(false)}>
                    <Square className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="mt-2">
                <Progress 
                  value={(elapsedSec / LIMIT_SECONDS) * 100} 
                  className="h-1" 
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
