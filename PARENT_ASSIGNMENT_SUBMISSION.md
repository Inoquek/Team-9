# Parent Assignment Submission System

This document describes the new modular system that allows parents to submit assignments with completion time tracking and study time analytics.

## Overview

The system has been redesigned to be more modular and maintainable, breaking down the functionality into focused components that are easier to debug and extend.

## New Components

### 1. StudyTimeTracker (`src/components/StudyTimeTracker.tsx`)
A dedicated component for tracking study time during assignments.

**Features:**
- Start/stop/pause timer functionality
- Progress tracking with visual indicators
- Minimizable interface
- Local storage persistence
- Maximum time limit (60 minutes per session)
- Auto-completion when time limit is reached

**Props:**
- `assignmentId`: Unique identifier for the assignment
- `assignmentTitle`: Display name for the assignment
- `estimatedTime`: Expected completion time in minutes
- `onTimeComplete`: Callback when timer is completed
- `isMinimized`: Whether to show minimized version
- `onToggleMinimize`: Toggle minimized state

### 2. AssignmentSubmissionForm (`src/components/AssignmentSubmissionForm.tsx`)
A comprehensive form for submitting completed assignments.

**Features:**
- File upload with progress tracking
- Support for multiple file types (images, videos, audio, documents)
- File size validation (5MB limit)
- Maximum 5 files per submission
- Optional submission notes
- Integration with study time tracking
- Real-time upload progress

**Props:**
- `assignment`: Assignment object with details
- `studentId`: ID of the student
- `parentId`: ID of the parent submitting
- `completionTimeMinutes`: Time spent on assignment
- `onSubmissionComplete`: Callback on successful submission
- `onCancel`: Cancel submission callback

### 3. StudyTimeDashboard (`src/components/StudyTimeDashboard.tsx`)
A dashboard showing study time analytics and progress.

**Features:**
- Daily, weekly, and monthly views
- Progress tracking with goals
- Visual charts using Recharts
- Real-time updates
- Achievement recognition
- Detailed breakdowns

**Props:**
- `studentId`: ID of the student
- `studentName`: Display name of the student

### 4. ParentAssignmentPage (`src/components/ParentAssignmentPage.tsx`)
A dedicated page for parents to manage assignments.

**Features:**
- Assignment overview with status tracking
- Integrated study timer
- Submission workflow
- Progress visualization
- Comments and feedback viewing

## New Services

### 1. StudyTimeService (`src/lib/services/studyTime.ts`)
Service for managing study time data in Firestore.

**Key Methods:**
- `getOrCreateStudyTimeEntry()`: Get or create daily study time entry
- `addStudyTime()`: Add completion time for an assignment
- `getTodayStudyTime()`: Get today's study statistics
- `getWeeklyStudyTime()`: Get weekly study statistics
- `getMonthlyStudyTime()`: Get monthly study statistics
- `subscribeToStudyTimeUpdates()`: Real-time updates

### 2. Enhanced SubmissionService
Updated to handle new fields and provide better analytics.

**New Methods:**
- `getParentSubmissions()`: Get submissions by parent ID
- `getSubmissionsWithStudyTime()`: Get submissions with time data
- `getSubmissionStats()`: Get submission statistics
- `updateSubmissionStatus()`: Update submission status

## Updated Types

### Submission Interface
```typescript
export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  parentId: string;
  files: SubmissionFile[];
  submittedAt: Date;
  status: 'pending' | 'approved' | 'needsRevision';
  feedback?: Feedback;
  points: number;
  completionTimeMinutes: number; // NEW: Time taken to complete
  studyTimeToday: number; // NEW: Total study time for the day
}
```

### Study Time Types
```typescript
export interface StudyTimeEntry {
  id: string;
  studentId: string;
  date: string; // ISO date string
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
```

## Workflow

### 1. Assignment Discovery
Parents see assignments in their dashboard with status indicators.

### 2. Study Time Tracking
- Click "Start Study Timer" to begin tracking
- Timer runs with pause/resume functionality
- Can be minimized to continue working
- Auto-completes after 60 minutes

### 3. Assignment Submission
- Upload files (images, videos, audio, documents)
- Add optional notes
- Submit with completion time
- Study time is automatically added to daily total

### 4. Progress Monitoring
- View study time dashboard
- Track daily/weekly/monthly progress
- See completion statistics
- Monitor goal achievement

## Database Structure

### Collections

#### `submissions`
- Stores assignment submissions with completion time
- Links to assignments and students
- Tracks submission status and feedback

#### `studyTime`
- Daily study time entries per student
- Tracks total minutes and completed assignments
- Real-time updates for live dashboard

## Usage Examples

### Starting a Study Session
```typescript
const handleStartTimer = (assignmentId: string) => {
  setActiveTimer(assignmentId);
};

<StudyTimeTracker
  assignmentId={assignment.id}
  assignmentTitle={assignment.title}
  estimatedTime={assignment.estimatedTime}
  onTimeComplete={(minutes) => handleTimeComplete(assignment.id, minutes)}
  onToggleMinimize={() => setActiveTimer(null)}
/>
```

### Submitting an Assignment
```typescript
const handleSubmission = async (submissionData) => {
  const submissionId = await SubmissionService.submitHomework(submissionData);
  await StudyTimeService.addStudyTime(studentId, today, completionTime);
  onSubmissionComplete(submissionId);
};

<AssignmentSubmissionForm
  assignment={assignment}
  studentId={studentId}
  parentId={parentId}
  completionTimeMinutes={completionTime}
  onSubmissionComplete={handleSubmission}
  onCancel={() => setShowForm(false)}
/>
```

### Viewing Study Analytics
```typescript
<StudyTimeDashboard
  studentId={studentId}
  studentName={studentName}
/>
```

## Benefits

1. **Modularity**: Each component has a single responsibility
2. **Maintainability**: Easier to debug and extend
3. **Reusability**: Components can be used in different contexts
4. **Real-time Updates**: Live study time tracking
5. **Comprehensive Analytics**: Detailed progress monitoring
6. **User Experience**: Intuitive workflow for parents

## Future Enhancements

1. **Study Goals**: Customizable daily/weekly goals
2. **Achievement System**: Badges for milestones
3. **Parent-Teacher Communication**: Direct messaging
4. **Progress Reports**: Automated progress summaries
5. **Mobile Optimization**: Better mobile experience
6. **Offline Support**: Work without internet connection

## Testing

To test the system:

1. Login as a parent user
2. Navigate to assignments page
3. Start a study timer for an assignment
4. Complete the assignment and submit
5. View study time dashboard
6. Check progress and statistics

## Troubleshooting

### Common Issues

1. **Timer not starting**: Check if another timer is already active
2. **Files not uploading**: Verify file size and type restrictions
3. **Study time not updating**: Check Firestore permissions
4. **Dashboard not loading**: Verify student assignment exists

### Debug Mode

Enable console logging to see detailed information about:
- Timer state changes
- File upload progress
- Study time calculations
- Database operations
