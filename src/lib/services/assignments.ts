import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  limit,
  onSnapshot
} from 'firebase/firestore';
import { ref, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { Assignment, Submission, Feedback, Comment, AssignmentWithComments } from '../types';
  
  // Average monthly scores for a student (across subjects)
  export async function getMonthlyAverageScores(studentId: string) {
    const q = query(collection(db, "submissions"), where("studentId", "==", studentId));
    const snap = await getDocs(q);

    const byMonth: Record<string, { sum: number; n: number }> = {};
    snap.forEach(doc => {
      const d = doc.data() as any;
      const created = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || Date.now());
      const key = created.toLocaleString("en-US", { month: "short" }); // Jan, Feb, ...
      if (!byMonth[key]) byMonth[key] = { sum: 0, n: 0 };
      if (typeof d.score === "number") { byMonth[key].sum += d.score; byMonth[key].n += 1; }
    });

    const order = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return order
      .map(m => byMonth[m] ? { month: m, avgScore: Math.round(byMonth[m].sum / byMonth[m].n) } : null)
      .filter(Boolean) as { month: string; avgScore: number }[];
  }

  // Submission breakdown for a student (submitted vs missed)
  export async function getSubmissionStatsForStudent(studentId: string) {
    const q = query(collection(db, "submissions"), where("studentId", "==", studentId));
    const snap = await getDocs(q);
    let submitted = 0, missed = 0;
    snap.forEach(doc => {
      const d = doc.data() as any;
      if (d.status === "missed") missed += 1;
      else submitted += 1; // treat everything else as submitted/present
    });
    return { submitted, missed };
  }
  export class AssignmentService {
    // Create new assignment
    static async createAssignment(assignment: Omit<Assignment, 'id' | 'createdAt'>): Promise<string> {
      try {
        const docRef = await addDoc(collection(db, 'assignments'), {
          ...assignment,
          createdAt: new Date()
        });
        return docRef.id;
      } catch (error) {
        console.error('Create assignment error:', error);
        throw error;
      }
    }
  
      // Get assignments for a class (simplified - no composite index required)
  static async getClassAssignments(classId: string): Promise<Assignment[]> {
    try {
      // First get all assignments for the class
      const q = query(
        collection(db, 'assignments'),
        where('classId', '==', classId)
      );
      
      const querySnapshot = await getDocs(q);
      let assignments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[];
      
      // Filter by status and sort in memory (avoids composite index requirement)
      assignments = assignments
        .filter(assignment => assignment.status === 'active' || assignment.status === 'completed')
        .sort((a, b) => {
          // Sort by due date (soonest first)
          const dueDateA = new Date(a.dueDate).getTime();
          const dueDateB = new Date(b.dueDate).getTime();
          return dueDateA - dueDateB;
        });
      
      return assignments;
    } catch (error) {
      console.error('Get assignments error:', error);
      throw error;
    }
  }

  // Get assignments for a class specifically for parents (includes all statuses)
  static async getClassAssignmentsForParents(classId: string): Promise<Assignment[]> {
    try {
      // First get all assignments for the class
      const q = query(
        collection(db, 'assignments'),
        where('classId', '==', classId)
      );
      
      const querySnapshot = await getDocs(q);
      let assignments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[];
      
      // For parents, show all assignments (active, completed, archived) but sort by status
      assignments = assignments.sort((a, b) => {
        // Active assignments first, then completed, then archived
        const statusOrder: Record<string, number> = { 'active': 0, 'completed': 1, 'archived': 2 };
        const statusDiff = (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        if (statusDiff !== 0) return statusDiff;
        
        // Then by due date (soonest first)
        const dueDateA = new Date(a.dueDate).getTime();
        const dueDateB = new Date(b.dueDate).getTime();
        return dueDateA - dueDateB;
      });
      
      return assignments;
    } catch (error) {
      console.error('Get assignments for parents error:', error);
      throw error;
    }
  }
  
    // Get assignments for a student
    static async getStudentAssignments(studentId: string): Promise<Assignment[]> {
      try {
        // First get the student to find their classId
        const studentDoc = await getDoc(doc(db, 'students', studentId));
        if (!studentDoc.exists()) {
          return [];
        }
        
        const studentData = studentDoc.data() as any; // Assuming Student type is defined elsewhere or needs to be imported
        const classId = studentData.classId;
        
        if (!classId) {
          return []; // Student not assigned to any class
        }

        // Get assignments for the student's class (simplified query)
        const q = query(
          collection(db, 'assignments'),
          where('classId', '==', classId)
        );
        
        const querySnapshot = await getDocs(q);
        let assignments = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Assignment[];
        
        // Filter and sort in memory
        assignments = assignments
          .filter(assignment => assignment.status === 'active')
          .sort((a, b) => {
            // Sort by due date (soonest first)
            const dueDateA = new Date(a.dueDate).getTime();
            const dueDateB = new Date(b.dueDate).getTime();
            return dueDateA - dueDateB;
          });
        
        return assignments;
      } catch (error) {
        console.error('Get student assignments error:', error);
        throw error;
      }
    }
  
    // Update assignment
    static async updateAssignment(id: string, updates: Partial<Assignment>): Promise<void> {
      try {
        await updateDoc(doc(db, 'assignments', id), updates);
      } catch (error) {
        console.error('Update assignment error:', error);
        throw error;
      }
    }
  
    // Delete assignment with cascading deletes
  static async deleteAssignment(id: string): Promise<void> {
    try {
      console.log(`Starting cascading delete for assignment: ${id}`);
      
      // 1. Delete all submissions for this assignment
      const submissionsQuery = query(
        collection(db, 'submissions'), 
        where('assignmentId', '==', id)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      if (!submissionsSnapshot.empty) {
        console.log(`Found ${submissionsSnapshot.docs.length} submissions to delete`);
        
        // Delete all submission files from storage first
        const deleteFilePromises = submissionsSnapshot.docs.map(async (subDoc) => {
          const submissionData = subDoc.data() as any;
          if (submissionData.files && Array.isArray(submissionData.files)) {
            return submissionData.files.map(async (file: any) => {
              if (file.url) {
                try {
                  // Extract file path from URL and delete from storage
                  const filePath = decodeURIComponent(file.url.split('/o/')[1]?.split('?')[0] || '');
                  if (filePath) {
                    const fileRef = ref(storage, filePath);
                    await deleteObject(fileRef);
                    console.log(`Deleted file: ${filePath}`);
                  }
                } catch (fileError) {
                  console.warn(`Failed to delete file: ${file.url}`, fileError);
                }
              }
            });
          }
        });
        
        // Wait for file deletions to complete
        await Promise.all(deleteFilePromises.flat());
        
        // Delete all submissions
        const deleteSubmissionPromises = submissionsSnapshot.docs.map(doc => 
          deleteDoc(doc.ref)
        );
        await Promise.all(deleteSubmissionPromises);
        console.log(`Deleted ${submissionsSnapshot.docs.length} submissions`);
      }
      
      // 2. Delete all comments for this assignment
      const commentsQuery = query(
        collection(db, 'assignments', id, 'comments')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      
      if (!commentsSnapshot.empty) {
        console.log(`Found ${commentsSnapshot.docs.length} comments to delete`);
        const deleteCommentPromises = commentsSnapshot.docs.map(doc => 
          deleteDoc(doc.ref)
        );
        await Promise.all(deleteCommentPromises);
        console.log(`Deleted ${commentsSnapshot.docs.length} comments`);
      }
      
      // 3. Delete assignment attachments from storage
      const assignmentDoc = await getDoc(doc(db, 'assignments', id));
      if (assignmentDoc.exists()) {
        const assignmentData = assignmentDoc.data() as Assignment;
        if (assignmentData.attachments && Array.isArray(assignmentData.attachments)) {
          const deleteAttachmentPromises = assignmentData.attachments.map(async (attachment) => {
            if (attachment.url) {
              try {
                const filePath = decodeURIComponent(attachment.url.split('/o/')[1]?.split('?')[0] || '');
                if (filePath) {
                  const fileRef = ref(storage, filePath);
                  await deleteObject(fileRef);
                  console.log(`Deleted attachment: ${filePath}`);
                }
              } catch (fileError) {
                console.warn(`Failed to delete attachment: ${attachment.url}`, fileError);
              }
            }
          });
          await Promise.all(deleteAttachmentPromises);
        }
      }
      
      // 4. Finally delete the assignment itself
      await deleteDoc(doc(db, 'assignments', id));
      console.log(`Assignment ${id} deleted successfully`);
      
    } catch (error) {
      console.error('Delete assignment error:', error);
      throw error;
    }
  }
  
        // Listen to real-time updates for assignments (simplified)
  static subscribeToAssignments(classId: string, callback: (assignments: Assignment[]) => void) {
    const q = query(
      collection(db, 'assignments'),
      where('classId', '==', classId)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      let assignments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Assignment[];
      
      // Filter and sort in memory
      assignments = assignments
        .filter(assignment => assignment.status === 'active')
        .sort((a, b) => {
          // Sort by due date (soonest first)
          const dueDateA = new Date(a.dueDate).getTime();
          const dueDateB = new Date(b.dueDate).getTime();
          return dueDateA - dueDateB;
        });
      
      callback(assignments);
    });
  }

  // Comment functionality
  static async addComment(assignmentId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'assignments', assignmentId, 'comments'), {
        ...comment,
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  }

  static async getAssignmentComments(assignmentId: string): Promise<Comment[]> {
    try {
      const q = query(
        collection(db, 'assignments', assignmentId, 'comments'),
        orderBy('createdAt', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
    } catch (error) {
      console.error('Get comments error:', error);
      throw error;
    }
  }

  static async updateComment(assignmentId: string, commentId: string, updates: Partial<Comment>): Promise<void> {
    try {
      await updateDoc(doc(db, 'assignments', assignmentId, 'comments', commentId), {
        ...updates,
        updatedAt: new Date(),
        isEdited: true
      });
    } catch (error) {
      console.error('Update comment error:', error);
      throw error;
    }
  }

  static async deleteComment(assignmentId: string, commentId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'assignments', assignmentId, 'comments', commentId));
    } catch (error) {
      console.error('Delete comment error:', error);
      throw error;
    }
  }

  // Get assignments with comments
  static async getClassAssignmentsWithComments(classId: string): Promise<AssignmentWithComments[]> {
    try {
      const assignments = await this.getClassAssignments(classId);
      const assignmentsWithComments = await Promise.all(
        assignments.map(async (assignment) => {
          try {
            const comments = await this.getAssignmentComments(assignment.id);
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
      
      return assignmentsWithComments;
    } catch (error) {
      console.error('Get assignments with comments error:', error);
      throw error;
    }
  }
}
  
  export class SubmissionService {
    // Submit homework
    static async submitHomework(submission: Omit<Submission, 'id' | 'submittedAt' | 'points'>): Promise<string> {
      try {
        const docRef = await addDoc(collection(db, 'submissions'), {
          ...submission,
          submittedAt: new Date(),
          points: 0
        });
        return docRef.id;
      } catch (error) {
        console.error('Submit homework error:', error);
        throw error;
      }
    }

    // Get submissions for an assignment
    static async getAssignmentSubmissions(assignmentId: string): Promise<Submission[]> {
      try {
        const q = query(
          collection(db, 'submissions'),
          where('assignmentId', '==', assignmentId),
          orderBy('submittedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Submission[];
      } catch (error) {
        console.error('Get submissions error:', error);
        throw error;
      }
    }

    // Get student submissions
    static async getStudentSubmissions(studentId: string): Promise<Submission[]> {
      try {
        console.log('getStudentSubmissions called with studentId:', studentId);
        
        const q = query(
          collection(db, 'submissions'),
          where('studentId', '==', studentId)
          // Temporarily removed orderBy to debug
        );
        
        console.log('Query created:', q);
        
        const querySnapshot = await getDocs(q);
        console.log('Query snapshot:', querySnapshot);
        console.log('Query snapshot empty:', querySnapshot.empty);
        console.log('Query snapshot size:', querySnapshot.size);
        
        if (!querySnapshot.empty) {
          console.log('Query snapshot docs:', querySnapshot.docs);
          querySnapshot.docs.forEach((doc, index) => {
            console.log(`Doc ${index}:`, doc.id, doc.data());
          });
        }
        
        const results = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Submission[];
        
        console.log('Final results:', results);
        return results;
      } catch (error) {
        console.error('Get student submissions error:', error);
        throw error;
      }
    }

    // Get parent submissions (for parents to see their submissions)
    static async getParentSubmissions(parentId: string): Promise<Submission[]> {
      try {
        console.log('getParentSubmissions called with parentId:', parentId);
        
        // Try without orderBy first to see if that's the issue
        const q = query(
          collection(db, 'submissions'),
          where('parentId', '==', parentId)
          // Temporarily removed orderBy to debug
        );
        
        console.log('Query created:', q);
        
        const querySnapshot = await getDocs(q);
        console.log('Query snapshot:', querySnapshot);
        console.log('Query snapshot empty:', querySnapshot.empty);
        console.log('Query snapshot size:', querySnapshot.size);
        
        if (!querySnapshot.empty) {
          console.log('Query snapshot docs:', querySnapshot.docs);
          querySnapshot.docs.forEach((doc, index) => {
            console.log(`Doc ${index}:`, doc.id, doc.data());
          });
        }
        
        const results = querySnapshot.docs.map(doc => {
          const data = doc.data();
          console.log('Processing doc data:', data);
          return {
            id: doc.id,
            ...data,
            submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt),
            // Convert other timestamp fields if they exist
            ...(data.feedback?.createdAt && {
              feedback: {
                ...data.feedback,
                createdAt: data.feedback.createdAt?.toDate ? data.feedback.createdAt.toDate() : new Date(data.feedback.createdAt)
              }
            })
          };
        }) as Submission[];
        
        console.log('Final results:', results);
        return results;
      } catch (error) {
        console.error('Get parent submissions error:', error);
        throw error;
      }
    }

    // Get submissions with study time statistics
    static async getSubmissionsWithStudyTime(studentId: string, startDate: string, endDate: string): Promise<Submission[]> {
      try {
        const q = query(
          collection(db, 'submissions'),
          where('studentId', '==', studentId),
          where('submittedAt', '>=', new Date(startDate)),
          where('submittedAt', '<=', new Date(endDate)),
          orderBy('submittedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Submission[];
      } catch (error) {
        console.error('Get submissions with study time error:', error);
        throw error;
      }
    }

    // Provide feedback on submission
    static async provideFeedback(submissionId: string, feedback: Omit<Feedback, 'id' | 'createdAt'>): Promise<void> {
      try {
        await updateDoc(doc(db, 'submissions', submissionId), {
          feedback: {
            ...feedback,
            id: submissionId,
            createdAt: new Date()
          },
          status: 'approved',
          points: feedback.points || 0, // Also update the main points field
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Provide feedback error:', error);
        throw error;
      }
    }

    // Update submission status
    static async updateSubmissionStatus(submissionId: string, status: 'pending' | 'approved' | 'needsRevision'): Promise<void> {
      try {
        await updateDoc(doc(db, 'submissions', submissionId), {
          status,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Update submission status error:', error);
        throw error;
      }
    }

    // Update submission points
    static async updateSubmissionPoints(submissionId: string, points: number): Promise<void> {
      try {
        await updateDoc(doc(db, 'submissions', submissionId), {
          points,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Update submission points error:', error);
        throw error;
      }
    }

    // Get submission statistics for a student
    static async getSubmissionStats(studentId: string): Promise<{
      totalSubmissions: number;
      totalStudyTime: number;
      averageTimePerSubmission: number;
      lastSubmissionDate: Date | null;
    }> {
      try {
        const submissions = await this.getStudentSubmissions(studentId);
        
        const totalSubmissions = submissions.length;
        const totalStudyTime = submissions.reduce((sum, sub) => sum + (sub.completionTimeMinutes || 0), 0);
        const averageTimePerSubmission = totalSubmissions > 0 ? Math.round(totalStudyTime / totalSubmissions) : 0;
        const lastSubmissionDate = submissions.length > 0 ? submissions[0].submittedAt : null;

        return {
          totalSubmissions,
          totalStudyTime,
          averageTimePerSubmission,
          lastSubmissionDate
        };
      } catch (error) {
        console.error('Get submission stats error:', error);
        throw error;
      }
    }

      // Create placeholder submissions for all students in class
  static async createPlaceholderSubmissions(data: {
    assignmentId: string;
    classId: string;
    teacherId: string;
  }): Promise<string[]> {
    try {
      // Get all students in the class
      const studentsQuery = query(
        collection(db, 'students'),
        where('classId', '==', data.classId),
        where('isActive', '==', true)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      
      const submissionIds: string[] = [];
      
      // Create a placeholder submission for each student
      for (const studentDoc of studentsSnapshot.docs) {
        const studentData = studentDoc.data();
        const studentId = studentDoc.id;
        
        console.log(`Creating placeholder submission for student ${studentId} (${studentData.name})`);
        
        const submissionData = {
          assignmentId: data.assignmentId,
          studentId: studentId,
          parentId: studentData.parentId, // Use actual parent ID, not teacher ID
          files: [], // No files for placeholder submissions
          submittedAt: new Date(),
          status: 'submitted', // Show as submitted to parents
          points: 0, // No points assigned yet
          completionTimeMinutes: 0, // No time tracked yet
          studyTimeToday: 0, // No study time tracking
          isInClassGrade: true, // Flag to identify in-class assignments
          submittedBy: 'teacher', // Indicates this was created by teacher
          isPlaceholder: true // Flag to identify placeholder submissions
        };
        
        console.log('Submission data:', submissionData);
        
        const docRef = await addDoc(collection(db, 'submissions'), submissionData);
        console.log(`Created submission with ID: ${docRef.id}`);
        
        submissionIds.push(docRef.id);
      }
      
      return submissionIds;
    } catch (error) {
      console.error('Create placeholder submissions error:', error);
      throw error;
    }
  }

    // Bulk create grades for multiple students
    static async createBulkInClassGrades(data: {
      assignmentId: string;
      classId: string;
      grades: Array<{
        studentId: string;
        points: number;
        notes?: string;
        completionTimeMinutes?: number;
      }>;
      teacherId: string;
    }): Promise<string[]> {
      try {
        const submissionIds: string[] = [];
        
        for (const grade of data.grades) {
          const submissionId = await this.createPlaceholderSubmissions({
            assignmentId: data.assignmentId,
            classId: data.classId || '',
            teacherId: data.teacherId
          });
          submissionIds.push(submissionId[0]); // Take first ID since createPlaceholderSubmissions returns array
        }
        
        return submissionIds;
      } catch (error) {
        console.error('Create bulk in-class grades error:', error);
        throw error;
      }
    }
  }


