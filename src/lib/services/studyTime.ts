import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { StudyTimeEntry, DailyStudyStats } from '../types';

export class StudyTimeService {
  // Get or create study time entry for a student on a specific date
  static async getOrCreateStudyTimeEntry(studentId: string, date: string): Promise<StudyTimeEntry> {
    try {
      const docRef = doc(db, 'studyTime', `${studentId}_${date}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as StudyTimeEntry;
      } else {
        // Create new entry
        const newEntry: Omit<StudyTimeEntry, 'id'> = {
          studentId,
          date,
          totalMinutes: 0,
          assignmentsCompleted: 0,
          lastUpdated: new Date()
        };
        
        await setDoc(docRef, newEntry);
        return {
          id: docSnap.id,
          ...newEntry
        };
      }
    } catch (error) {
      console.error('Get or create study time entry error:', error);
      throw error;
    }
  }

  // Add study time for an assignment completion
  static async addStudyTime(studentId: string, date: string, minutes: number): Promise<void> {
    try {
      const entry = await this.getOrCreateStudyTimeEntry(studentId, date);
      
      await updateDoc(doc(db, 'studyTime', entry.id), {
        totalMinutes: entry.totalMinutes + minutes,
        assignmentsCompleted: entry.assignmentsCompleted + 1,
        lastUpdated: new Date()
      });
    } catch (error) {
      console.error('Add study time error:', error);
      throw error;
    }
  }

  // Get study time for a specific date
  static async getStudyTimeForDate(studentId: string, date: string): Promise<StudyTimeEntry | null> {
    try {
      const docRef = doc(db, 'studyTime', `${studentId}_${date}`);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        } as StudyTimeEntry;
      }
      return null;
    } catch (error) {
      console.error('Get study time for date error:', error);
      throw error;
    }
  }

  // Get study time for a date range
  static async getStudyTimeForDateRange(studentId: string, startDate: string, endDate: string): Promise<StudyTimeEntry[]> {
    try {
      const q = query(
        collection(db, 'studyTime'),
        where('studentId', '==', studentId),
        where('date', '>=', startDate),
        where('date', '<=', endDate)
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as StudyTimeEntry[];
    } catch (error) {
      console.error('Get study time for date range error:', error);
      throw error;
    }
  }

  // Get today's study time
  static async getTodayStudyTime(studentId: string): Promise<StudyTimeEntry | null> {
    const today = new Date().toISOString().split('T')[0];
    return this.getStudyTimeForDate(studentId, today);
  }

  // Get weekly study time summary
  static async getWeeklyStudyTime(studentId: string): Promise<DailyStudyStats[]> {
    try {
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      
      const startDate = startOfWeek.toISOString().split('T')[0];
      const endDate = today.toISOString().split('T')[0];
      
      const entries = await this.getStudyTimeForDateRange(studentId, startDate, endDate);
      
      // Create array of all days in the week
      const weekStats: DailyStudyStats[] = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        
        const entry = entries.find(e => e.date === dateStr);
        weekStats.push({
          date: dateStr,
          totalMinutes: entry?.totalMinutes || 0,
          assignmentsCompleted: entry?.assignmentsCompleted || 0,
          averageTimePerAssignment: entry && entry.assignmentsCompleted > 0 
            ? Math.round(entry.totalMinutes / entry.assignmentsCompleted) 
            : 0
        });
      }
      
      return weekStats;
    } catch (error) {
      console.error('Get weekly study time error:', error);
      throw error;
    }
  }

  // Get monthly study time summary
  static async getMonthlyStudyTime(studentId: string, year: number, month: number): Promise<DailyStudyStats[]> {
    try {
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month
      
      const entries = await this.getStudyTimeForDateRange(studentId, startDate, endDate);
      
      return entries.map(entry => ({
        date: entry.date,
        totalMinutes: entry.totalMinutes,
        assignmentsCompleted: entry.assignmentsCompleted,
        averageTimePerAssignment: entry.assignmentsCompleted > 0 
          ? Math.round(entry.totalMinutes / entry.assignmentsCompleted) 
          : 0
      }));
    } catch (error) {
      console.error('Get monthly study time error:', error);
      throw error;
    }
  }

  // Listen to real-time updates for a student's study time
  static subscribeToStudyTimeUpdates(studentId: string, date: string, callback: (entry: StudyTimeEntry | null) => void) {
    const docRef = doc(db, 'studyTime', `${studentId}_${date}`);
    
    return onSnapshot(docRef, (doc) => {
      if (doc.exists()) {
        callback({
          id: doc.id,
          ...doc.data()
        } as StudyTimeEntry);
      } else {
        callback(null);
      }
    });
  }
}

export async function getWeeklyEngagementForStudent(studentId: string) {
  // expects documents like: { studentId, minutes, date }
  const q = query(collection(db, "studyTime"), where("studentId", "==", studentId));
  const snap = await getDocs(q);

  // ISO week calc
  const weekNumber = (d: Date) => {
    const a = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = a.getUTCDay() || 7;
    a.setUTCDate(a.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(a.getUTCFullYear(), 0, 1));
    return Math.ceil((((a as any) - (yearStart as any)) / 86400000 + 1) / 7);
  };

  const cur = new Date();
  const curYear = cur.getUTCFullYear();
  const curWeek = weekNumber(cur);

  const minutes = snap.docs.reduce((sum, d) => {
    const v = d.data() as any;
    const dt = v.date?.toDate ? v.date.toDate() : new Date(v.date || Date.now());
    return (dt.getUTCFullYear() === curYear && weekNumber(dt) === curWeek)
      ? sum + (v.minutes || 0)
      : sum;
  }, 0);

  return { minutes, recommendedMinutes: 180 }; // 3h default recommendation
}