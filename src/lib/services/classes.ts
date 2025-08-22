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
import { Class, Student, User } from '../types';

export class ClassService {
  // Create a new class
  static async createClass(classData: Omit<Class, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'classes'), {
        ...classData,
        createdAt: new Date()
      });
      
      // Don't update teacher's classId - they can teach multiple classes
      // Just create the class with the teacherId reference
      
      return docRef.id;
    } catch (error) {
      console.error('Create class error:', error);
      throw error;
    }
  }

  // Get class by ID
  static async getClass(classId: string): Promise<Class | null> {
    try {
      const classDoc = await getDoc(doc(db, 'classes', classId));
      if (classDoc.exists()) {
        return { id: classDoc.id, ...classDoc.data() } as Class;
      }
      return null;
    } catch (error) {
      console.error('Get class error:', error);
      throw error;
    }
  }

  // Get classes taught by a teacher
  static async getTeacherClasses(teacherId: string): Promise<Class[]> {
    try {
      const q = query(
        collection(db, 'classes'),
        where('teacherId', '==', teacherId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Class[];
    } catch (error) {
      console.error('Get teacher classes error:', error);
      throw error;
    }
  }

  // Add method to get classes by teacher
  static async getClassesByTeacher(teacherId: string): Promise<Class[]> {
    try {
      const q = query(
        collection(db, 'classes'),
        where('teacherId', '==', teacherId),
        where('isActive', '==', true),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Class[];
    } catch (error) {
      console.error('Get classes by teacher error:', error);
      throw error;
    }
  }

  // Get students in a class
  static async getClassStudents(classId: string): Promise<Student[]> {
    try {
      const q = query(
        collection(db, 'students'),
        where('classId', '==', classId),
        where('isActive', '==', true)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Student[];
    } catch (error) {
      console.error('Get class students error:', error);
      throw error;
    }
  }

  // Add student to class
  static async addStudentToClass(studentId: string, classId: string): Promise<void> {
    try {
      // Update student's classId
      await updateDoc(doc(db, 'students', studentId), {
        classId: classId
      });

      // Add student to class students array
      const classRef = doc(db, 'classes', classId);
      const classDoc = await getDoc(classRef);
      if (classDoc.exists()) {
        const currentStudents = classDoc.data().students || [];
        if (!currentStudents.includes(studentId)) {
          await updateDoc(classRef, {
            students: [...currentStudents, studentId]
          });
        }
      }
    } catch (error) {
      console.error('Add student to class error:', error);
      throw error;
    }
  }

  // Remove student from class
  static async removeStudentFromClass(studentId: string, classId: string): Promise<void> {
    try {
      // Update student's classId to null
      await updateDoc(doc(db, 'students', studentId), {
        classId: null
      });

      // Remove student from class students array
      const classRef = doc(db, 'classes', classId);
      const classDoc = await getDoc(classRef);
      if (classDoc.exists()) {
        const currentStudents = classDoc.data().students || [];
        const updatedStudents = currentStudents.filter((id: string) => id !== studentId);
        await updateDoc(classRef, {
          students: updatedStudents
        });
      }
    } catch (error) {
      console.error('Remove student from class error:', error);
      throw error;
    }
  }

  // Move student from one class to another (efficient method)
  static async moveStudentBetweenClasses(studentId: string, oldClassId: string | null, newClassId: string | null): Promise<void> {
    try {
      // Update student's classId
      await updateDoc(doc(db, 'students', studentId), {
        classId: newClassId
      });

      // Remove from old class if it exists
      if (oldClassId) {
        const oldClassRef = doc(db, 'classes', oldClassId);
        const oldClassDoc = await getDoc(oldClassRef);
        if (oldClassDoc.exists()) {
          const currentStudents = oldClassDoc.data().students || [];
          const updatedStudents = currentStudents.filter((id: string) => id !== studentId);
          await updateDoc(oldClassRef, {
            students: updatedStudents
          });
        }
      }

      // Add to new class if it exists
      if (newClassId) {
        const newClassRef = doc(db, 'classes', newClassId);
        const newClassDoc = await getDoc(newClassRef);
        if (newClassDoc.exists()) {
          const currentStudents = newClassDoc.data().students || [];
          if (!currentStudents.includes(studentId)) {
            await updateDoc(newClassRef, {
              students: [...currentStudents, studentId]
            });
          }
        }
      }
    } catch (error) {
      console.error('Move student between classes error:', error);
      throw error;
    }
  }

  // Sync class students array with actual student records (for data consistency)
  static async syncClassStudents(classId: string): Promise<void> {
    try {
      // Get actual students in this class
      const actualStudents = await this.getClassStudents(classId);
      const actualStudentIds = actualStudents.map(student => student.id);
      
      // Get current class document
      const classRef = doc(db, 'classes', classId);
      const classDoc = await getDoc(classRef);
      
      if (classDoc.exists()) {
        const currentStudents = classDoc.data().students || [];
        
        // Update if there's a mismatch
        if (JSON.stringify(currentStudents.sort()) !== JSON.stringify(actualStudentIds.sort())) {
          await updateDoc(classRef, {
            students: actualStudentIds
          });
          console.log(`Synced class ${classId} students array with actual records`);
        }
      }
    } catch (error) {
      console.error('Sync class students error:', error);
      throw error;
    }
  }

  // Listen to class updates
  static subscribeToClass(classId: string, callback: (classData: Class | null) => void) {
    return onSnapshot(doc(db, 'classes', classId), (doc) => {
      if (doc.exists()) {
        callback({ id: doc.id, ...doc.data() } as Class);
      } else {
        callback(null);
      }
    });
  }
}
