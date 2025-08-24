// Add these new types
export interface Class {
  id: string;
  name: string;
  teacherId: string;
  grade: string;
  academicYear: string;
  createdAt: Date;
  isActive: boolean;
  students: string[]; // Array of student IDs
}

export interface Student {
  id: string;
  name: string;
  parentId: string;
  classId: string;
  grade: string;
  createdAt: Date;
  isActive: boolean;
}

// Simplify the User interface to only essential fields:
export interface User {
  uid: string;
  username: string;
  email: string; // Keep this for Firebase Auth compatibility
  role: 'parent' | 'teacher' | 'admin';
  displayName: string;
  createdAt: Date;
  lastLoginAt: Date;
  isActive: boolean;
  classId?: string | null; // Optional, can be null
}

// Update Assignment interface
export interface Assignment {
  id: string;
  title: string;
  description: string;
  category:string;
  type: 'alphabet-time' | 'vocabulary-time' | 'sight-words-time' | 'reading-time' | 'post-programme-test';
  dueDate: Date;
  teacherId: string;
  classId: string;
  attachments?: FileAttachment[];
  instructions?: string;
  points: number;
  estimatedTime: number;
  createdAt: Date;
  status: 'active' | 'completed' | 'archived';
}

export interface FileAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: Date;
}

// Session management
export interface UserSession {
  uid: string;
  username: string;
  role: string;
  displayName: string;
  lastLoginAt: Date;
  isActive: boolean;
}

// Username validation
export interface UsernameValidation {
  isValid: boolean;
  message?: string;
}

// Portfolio types
export interface Portfolio {
  id: string;
  studentId: string;
  categories: {
    alphabet: CategoryProgress;
    vocabulary: CategoryProgress;
    sightWords: CategoryProgress;
    reading: CategoryProgress;
    writing: CategoryProgress;
  };
  totalPoints: number;
  badges: Badge[];
  createdAt: Date;
  updatedAt: Date;
}

// NEW: Garden and Class Summary types
export interface ClassSummary {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  lastUpdated: Date;
  
  // Aggregated statistics (safe for parents to see)
  totalStudents: number;
  averageCompletionRate: number;
  totalAssignments: number;
  completedAssignments: number;
  
  // Performance distribution (anonymized)
  performanceDistribution: {
    fruiting: number;      // 95-100%
    blooming: number;      // 90-94%
    flowering: number;     // 80-89%
    budding: number;       // 70-79%
    sprout: number;        // 60-69%
    growing: number;       // 45-59%
    seedling: number;      // 25-44%
    germinating: number;   // 10-24%
    seed: number;          // 0-9%
  };
  
  // Recent activity (last 7 days)
  recentActivity: {
    newSubmissions: number;
    completedAssignments: number;
    averageStudyTime: number;
  };
}

export interface GardenStudentData {
  id: string;
  name: string;
  completionRate: number;
  stage: 'seed' | 'germinating' | 'seedling' | 'growing' | 'sprout' | 'budding' | 'flowering' | 'blooming' | 'fruiting';
  totalAssignments: number;
  completedAssignments: number;
  totalPoints: number;
  earnedPoints: number;
  lastActivity: Date;
  isOwnChild?: boolean; // For parent view
}

export interface CategoryProgress {
  level: number;
  points: number;
  completedAssignments: number;
  totalAssignments: number;
  lastActivity: Date;
}



// Submission types
export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  parentId: string;
  files: SubmissionFile[];
  submittedAt: Date;
  status: 'submitted' | 'pending' | 'approved' | 'needsRevision' | 'completed';
  feedback?: Feedback;
  points: number;
  completionTimeMinutes: number; // Time taken to complete in minutes
  studyTimeToday: number; // Total study time for the day when submitted
  isInClassGrade?: boolean; // New: indicates if this was graded in-class
  submittedBy?: 'parent' | 'teacher'; // New: who created the submission
  isPlaceholder?: boolean; // New: indicates if this is a placeholder submission for teacher grading
}

export interface SubmissionFile {
  id: string;
  type: 'image' | 'video' | 'audio';
  url: string;
  filename: string;
  size: number;
  uploadedAt: Date;
}

export interface Feedback {
  id: string;
  teacherId: string;
  message: string;
  emoji?: string;
  voiceNote?: string;
  points: number;
  createdAt: Date;
}

// Comment types for assignments and announcements
export interface Comment {
  id: string;
  userId: string;
  userDisplayName: string;
  userRole: 'teacher' | 'parent' | 'admin';
  content: string;
  createdAt: Date;
  updatedAt?: Date;
  isEdited?: boolean;
}

// Extended Assignment interface with comments
export interface AssignmentWithComments extends Assignment {
  comments?: Comment[];
  commentCount?: number;
}

// Extended Announcement interface with comments
export interface AnnouncementWithComments extends Announcement {
  comments?: Comment[];
  commentCount?: number;
}

// Badge types
export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  pointsRequired: number;
  unlockedAt?: Date;
}

// Announcement types
export interface Announcement {
  id: string;
  title: string;
  content: string;
  type?: 'event' | 'reminder' | 'activity' | 'general';
  teacherId: string;
  classId: string;
  priority: 'low' | 'normal' | 'high';
  attachments?: FileAttachment[];
  createdAt: Date;
  readBy: string[]; // Array of user IDs who read it
}

// Gamification types
export interface LeaderboardEntry {
  id: string;
  familyId: string;
  familyName: string;
  totalPoints: number;
  rank: number;
  lastActivity: Date;
  badges: Badge[];
}

// Study time tracking types
export interface StudyTimeEntry {
  id: string;
  studentId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  totalMinutes: number;
  assignmentsCompleted: number;
  lastUpdated: Date;
}

export interface DailyStudyStats {
  date: string;
  totalMinutes: number;
  assignmentsCompleted: number;
  averageTimePerAssignment: number;
}



