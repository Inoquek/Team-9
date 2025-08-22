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
          status: 'pending',
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
  }


