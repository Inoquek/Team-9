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

type SubjectPerf = { subject: string; childAvg: number; classAvg: number };
type ClassRankingRow = { studentId: string; studentName: string; subject: string; rank: number; avgScore: number };

// Child vs class averages per subject
export async function getSubjectAveragesForStudent(studentId: string, classId?: string): Promise<SubjectPerf[]> {
  const subjects = ["Math","Science","Reading","Writing","Art"];
  if (!classId) return subjects.map(s => ({ subject: s, childAvg: 0, classAvg: 0 }));

  const q = query(collection(db, "submissions"), where("classId","==",classId));
  const snap = await getDocs(q);

  const agg: Record<string, { sum: number; n: number; childSum: number; childN: number }> = {};
  subjects.forEach(s => agg[s] = { sum: 0, n: 0, childSum: 0, childN: 0 });

  snap.forEach(doc => {
    const d = doc.data() as any;
    const s = d.subject || "Other";
    if (!agg[s]) agg[s] = { sum: 0, n: 0, childSum: 0, childN: 0 };
    if (typeof d.score === "number") {
      agg[s].sum += d.score; agg[s].n += 1;
      if (d.studentId === studentId) { agg[s].childSum += d.score; agg[s].childN += 1; }
    }
  });

  return Object.keys(agg).map(s => ({
    subject: s,
    classAvg: agg[s].n ? Math.round(agg[s].sum / agg[s].n) : 0,
    childAvg: agg[s].childN ? Math.round(agg[s].childSum / agg[s].childN) : 0,
  }));
}

// Subject-wise rankings inside a class
export async function getSubjectRankingsForClass(classId: string): Promise<ClassRankingRow[]> {
  const q = query(collection(db, "submissions"), where("classId","==",classId));
  const snap = await getDocs(q);

  const bySubject: Record<string, Record<string, { name: string; sum: number; n: number }>> = {};
  snap.forEach(doc => {
    const d = doc.data() as any;
    const s = d.subject || "Other";
    if (!bySubject[s]) bySubject[s] = {};
    if (!bySubject[s][d.studentId]) bySubject[s][d.studentId] = { name: d.studentName || d.studentId, sum: 0, n: 0 };
    if (typeof d.score === "number") {
      bySubject[s][d.studentId].sum += d.score;
      bySubject[s][d.studentId].n += 1;
    }
  });

  const rows: ClassRankingRow[] = [];
  Object.keys(bySubject).forEach(subject => {
    const list = Object.entries(bySubject[subject]).map(([studentId, v]) => ({
      studentId,
      studentName: v.name,
      subject,
      avgScore: v.n ? v.sum / v.n : 0
    })).sort((a,b)=>b.avgScore - a.avgScore)
      .map((r, i) => ({ ...r, rank: i + 1 }));
    rows.push(...list);
  });

  return rows;
}


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
