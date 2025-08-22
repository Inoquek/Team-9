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
  import { db } from '../firebase';
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
        .filter(assignment => assignment.status === 'active')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      return assignments;
    } catch (error) {
      console.error('Get assignments error:', error);
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
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
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
  
    // Delete assignment
    static async deleteAssignment(id: string): Promise<void> {
      try {
        await deleteDoc(doc(db, 'assignments', id));
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
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
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
    static async submitHomework(submission: Omit<Submission, 'id' | 'submittedAt' | 'status' | 'points'>): Promise<string> {
      try {
        const docRef = await addDoc(collection(db, 'submissions'), {
          ...submission,
          submittedAt: new Date(),
          status: 'submitted', // Changed from 'pending' to 'submitted'
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
        const q = query(
          collection(db, 'submissions'),
          where('studentId', '==', studentId),
          orderBy('submittedAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Submission[];
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
          status: 'approved'
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
  }


