import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs,
  query, 
  where, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { Student } from '../types';

export class StudentService {
  // Create new student
  static async createStudent(studentData: Omit<Student, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'students'), {
        ...studentData,
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Create student error:', error);
      throw error;
    }
  }

  // Get student by ID
  static async getStudent(studentId: string): Promise<Student | null> {
    try {
      const studentDoc = await getDoc(doc(db, 'students', studentId));
      if (studentDoc.exists()) {
        return { id: studentDoc.id, ...studentDoc.data() } as Student;
      }
      return null;
    } catch (error) {
      console.error('Get student error:', error);
      throw error;
    }
  }

  // Get students by parent ID
  static async getStudentsByParent(parentId: string): Promise<Student[]> {
    try {
      const q = query(
        collection(db, 'students'),
        where('parentId', '==', parentId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
    } catch (error) {
      console.error('Get students by parent error:', error);
      throw error;
    }
  }

  // Get students by class ID
  static async getStudentsByClass(classId: string): Promise<Student[]> {
    try {
      const q = query(
        collection(db, 'students'),
        where('classId', '==', classId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
    } catch (error) {
      console.error('Get students by class error:', error);
      throw error;
    }
  }

  // Update student
  static async updateStudent(studentId: string, updates: Partial<Student>): Promise<void> {
    try {
      await updateDoc(doc(db, 'students', studentId), updates);
    } catch (error) {
      console.error('Update student error:', error);
      throw error;
    }
  }

  // Delete student (soft delete)
  static async deleteStudent(studentId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'students', studentId), {
        isActive: false
      });
    } catch (error) {
      console.error('Delete student error:', error);
      throw error;
    }
  }
}
