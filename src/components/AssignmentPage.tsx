import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Calendar, Clock, CheckCircle, Plus, Edit, Trash2, Eye, Users, MessageCircle, File, Download, Play, Pause, Square, Upload, X, Star, Trophy, Target, FileText, ExternalLink, TrendingUp } from "lucide-react";
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
  const [completionAnimation, setCompletionAnimation] = useState<string | null>(null);
  const [stopwatchMinimized, setStopwatchMinimized] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  
  // New state for enhanced parent functionality
  const [showStudyDashboard, setShowStudyDashboard] = useState(false);
  const [completionTimes, setCompletionTimes] = useState<Record<string, number>>({});
  const [showSubmissionForm, setShowSubmissionForm] = useState<string | null>(null);
  const [studentInfo, setStudentInfo] = useState<{ id: string; name: string } | null>(null);
  
  // Store final stopwatch time for submissions
  const [finalStopwatchTime, setFinalStopwatchTime] = useState<Record<string, number>>({});
  
  // New state for teacher submission viewing
  const [viewingSubmissionsFor, setViewingSubmissionsFor] = useState<string | null>(null);
  
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

  // Load user submissions
  useEffect(() => {
    const loadUserSubmissions = async () => {
      if (!user) return;
      
      try {
        let userSubmissions: Submission[] = [];
        
        if (userRole === 'parent') {
          // For parents, get their own submissions
          console.log('Loading submissions for parent:', user.uid);
          console.log('User object:', user);
          console.log('User role:', userRole);
          
          // Test Firestore access first
          await testFirestoreAccess();
          
          // Get submissions for the current user (parent)
          userSubmissions = await SubmissionService.getParentSubmissions(user.uid);
          console.log('Loaded parent submissions:', userSubmissions);
          
          // Also update completion times immediately
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
            
            // Get all submissions for assignments in the selected class
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
            
            console.log('Loaded teacher submissions for class:', userSubmissions);
          }
        }
        
        setSubmissions(userSubmissions);
        
      } catch (error) {
        console.error('Error loading user submissions:', error);
        // Set empty submissions array on error to prevent undefined issues
        setSubmissions([]);
        if (userRole === 'parent') {
          setCompletionTimes({});
        }
      }
    };

    loadUserSubmissions();
  }, [user, userRole, selectedClass, assignments]); // Added selectedClass and assignments dependencies

  // Load student info and study time data for parents
  useEffect(() => {
    const loadStudentData = async () => {
      if (!user || userRole !== 'parent') return;
      
      try {
        // Get parent's student(s)
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
      } catch (error) {
        console.error('Error loading student data:', error);
      }
    };

    loadStudentData();
  }, [user, userRole]); // Removed submissions dependency

  // Helper function to get submitted assignments count for parents
  const getSubmittedAssignmentsCount = () => {
    if (userRole !== 'parent') return 0;
    return submissions.length;
  };

  // Helper function to find submission by assignment ID
  const findSubmissionByAssignment = (assignmentId: string): Submission | undefined => {
    const submission = submissions.find(sub => sub.assignmentId === assignmentId);
    console.log(`Looking for submission for assignment ${assignmentId}:`, submission);
    console.log('All submissions:', submissions);
    return submission;
  };

  // Check for existing submissions when assignments load
  const checkExistingSubmissions = async () => {
    if (!user || assignments.length === 0) return;
    
    try {
      let userSubmissions: Submission[] = [];
      
      if (userRole === 'parent') {
        // Get all submissions for this parent
        userSubmissions = await SubmissionService.getParentSubmissions(user.uid);
        console.log('Checking existing submissions for parent:', userSubmissions);
      } else if (userRole === 'teacher' && selectedClass) {
        // Get all submissions for assignments in the selected class
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
        
        console.log('Checking existing submissions for teacher class:', userSubmissions);
      }
      
      // Update submissions state
      setSubmissions(userSubmissions);
      
      // Update completion times for parents
      if (userRole === 'parent') {
        const times: Record<string, number> = {};
        userSubmissions.forEach(sub => {
          times[sub.assignmentId] = sub.completionTimeMinutes || 0;
        });
        setCompletionTimes(times);
        console.log('Updated completion times from existing submissions:', times);
      }
    } catch (error) {
      console.error('Error checking existing submissions:', error);
    }
  };

  // Run check for existing submissions when assignments load
  useEffect(() => {
    checkExistingSubmissions();
  }, [assignments, user, userRole]);

  // Safe rendering function for feedback
  const renderFeedback = (feedback: any) => {
    if (!feedback || typeof feedback !== 'object') return null;
    
    return (
      <div className="p-3 bg-blue-50 rounded border border-blue-200">
        <div className="flex items-center mb-1">
          <MessageCircle className="w-4 h-4 text-blue-600 mr-1" />
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

  // Function to test Firestore access
  const testFirestoreAccess = async () => {
    if (!user || userRole !== 'parent') return;
    
    try {
      console.log('Testing Firestore access...');
      
      // Try to read all submissions (without where clause)
      const allSubmissionsQuery = query(collection(db, 'submissions'));
      const allSubmissionsSnapshot = await getDocs(allSubmissionsQuery);
      console.log('All submissions snapshot:', allSubmissionsSnapshot);
      console.log('All submissions empty:', allSubmissionsSnapshot.empty);
      console.log('All submissions size:', allSubmissionsSnapshot.size);
      
      if (!allSubmissionsSnapshot.empty) {
        allSubmissionsSnapshot.docs.forEach((doc, index) => {
          const data = doc.data();
          console.log(`All submission ${index}:`, doc.id, {
            parentId: data.parentId,
            studentId: data.studentId,
            assignmentId: data.assignmentId,
            status: data.status
          });
        });
      }
      
      // Try to read specific submission by ID if we know one
      if (allSubmissionsSnapshot.size > 0) {
        const firstDoc = allSubmissionsSnapshot.docs[0];
        console.log('First submission doc:', firstDoc.id, firstDoc.data());
      }
      
    } catch (error) {
      console.error('Error testing Firestore access:', error);
    }
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
        studyTimeToday: 0 // Will be updated by StudyTimeService
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
        }
      } catch (studyTimeError) {
        console.warn('Could not update study time:', studyTimeError);
      }

      // Mark assignment as complete for the student
      await markAssignmentComplete(assignmentId);

      // Update local submissions state
      const newSubmission: Submission = {
        id: submissionId,
        assignmentId,
        studentId: studentInfo?.id || user.uid, // Use actual student ID if available
        parentId: user.uid,
        files: uploadedSubmissionFiles,
        submittedAt: new Date(),
        status: 'submitted', // Changed from 'pending' to 'submitted'
        points: 0,
        completionTimeMinutes: Math.ceil(timeSpent / 60),
        studyTimeToday: 0
      };

      setSubmissions(prev => [newSubmission, ...prev]);
      
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
        title: "Assignment submitted successfully!",
        description: "Your work has been uploaded and submitted to your teacher.",
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

  const completeAssignment = (assignmentId: string) => {
    // Stop timer if running for this assignment
    const state = loadStopwatch();
    if (state.running && state.assignmentId === assignmentId) {
      stopAndSave();
    }

    // Trigger completion animation
    setCompletionAnimation(assignmentId);
    setTimeout(() => setCompletionAnimation(null), 2000);

    // Update completed assignments count
    setTodayCompletedAssignments(getTodayCompletedAssignments());

    toast({
      title: "🎉 Assignment Completed!",
      description: "Great job! You've completed this assignment.",
    });
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
  }, [user, toast, selectedClass]);

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
        
        // Also check for existing submissions to ensure persistence
        await checkExistingSubmissions();
      } catch (error) {
        console.error('Error refreshing submissions:', error);
      }
    };
    
    refreshSubmissions();
  };

  // Function to mark assignment as complete for the student
  const markAssignmentComplete = async (assignmentId: string) => {
    try {
      // Update the assignment status to 'completed' in Firestore
      const assignmentRef = doc(db, 'assignments', assignmentId);
      await updateDoc(assignmentRef, {
        status: 'completed',
        completedAt: new Date()
      });

      toast({
        title: "Assignment Completed!",
        description: "This assignment has been marked as complete for your student.",
      });
    } catch (error) {
      console.error('Error marking assignment complete:', error);
      toast({
        title: "Error",
        description: "Failed to mark assignment as complete. Please try again.",
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
          {userRole === "parent" && (
            <Button
              variant="outline"
              onClick={() => setShowStudyDashboard(!showStudyDashboard)}
            >
              <TrendingUp className="h-4 w-4 mr-2" />
              Study Dashboard
            </Button>
          )}
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v)}>
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
                setIsAssignDialogOpen(o);
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
                      onValueChange={(value) => setDraft((d) => ({ ...d, subject: value }))}
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

      {/* Study Time Dashboard for Parents */}
      {userRole === "parent" && showStudyDashboard && studentInfo && (
        <StudyTimeDashboard
          studentId={studentInfo.id}
          studentName={studentInfo.name}
        />
      )}

      {/* Stats Cards */}
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
                  {userRole === "parent" 
                    ? getSubmittedAssignmentsCount() // Show submitted assignments count for parents
                    : assignments.filter(a => a.status === "active").length // Show active assignments for teachers/admins
                  }
                </p>
                <p className="text-sm text-muted-foreground">
                  {userRole === "parent" ? "Submitted" : "Active"}
                </p>
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
                      {/* Show completion status for parents */}
                      {userRole === "parent" && findSubmissionByAssignment(assignment.id) && (
                        <Badge variant="success" className="flex items-center space-x-1">
                          <CheckCircle className="h-4 w-4" />
                          <span>Submitted</span>
                        </Badge>
                      )}
                      {/* Show submissions count for teachers */}
                      {userRole === "teacher" && (
                        <Badge variant="outline" className="flex items-center space-x-1">
                          <FileText className="h-4 w-4" />
                          <span>
                            {submissions.filter(sub => sub.assignmentId === assignment.id).length} submissions
                          </span>
                        </Badge>
                      )}
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
                    {/* View Submissions button for teachers */}
                    {userRole === "teacher" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewingSubmissionsFor(assignment.id)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        View Submissions
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              
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

                {/* Completion Time Display for Submitted Assignments */}
                {userRole === "parent" && findSubmissionByAssignment(assignment.id) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-green-700">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        Completed in: {findSubmissionByAssignment(assignment.id)?.completionTimeMinutes || 0} minutes
                      </span>
                    </div>
                  </div>
                )}

                {/* Parent Action Buttons */}
                {userRole === "parent" && (
                  <div className="flex flex-col sm:flex-row gap-3">
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
                    
                    <div className="relative">
                      <Button
                        variant="default"
                        onClick={() => completeAssignment(assignment.id)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Complete Assignment
                      </Button>
                      
                      {/* Completion Animation */}
                      {completionAnimation === assignment.id && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="animate-ping">
                            <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* My Submission - Only for parents */}
                {userRole === "parent" && findSubmissionByAssignment(assignment.id) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-green-800 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Your Submission
                      </h4>
                      <Badge variant="secondary" className="text-green-700 bg-green-100">
                        {findSubmissionByAssignment(assignment.id)?.status}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm text-green-700">
                        Submitted: {new Date(findSubmissionByAssignment(assignment.id)?.submittedAt || new Date()).toLocaleString()}
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
