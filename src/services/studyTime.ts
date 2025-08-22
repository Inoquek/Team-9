import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

// Weekly engagement minutes for a student (sum of this ISO week)
export async function getWeeklyEngagementForStudent(studentId: string) {
  // assumes a studyTime collection with { studentId, minutes, date }
  const q = query(collection(db, "studyTime"), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  const now = new Date();
  const weekNumber = (d: Date) => {
    const a = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = a.getUTCDay() || 7;
    a.setUTCDate(a.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(a.getUTCFullYear(),0,1));
    return Math.ceil((((a as any) - (yearStart as any)) / 86400000 + 1) / 7);
  };
  const curW = weekNumber(now);
  const minutes = snap.docs.reduce((sum, doc) => {
    const d = doc.data() as any;
    const dt = d.date?.toDate ? d.date.toDate() : new Date(d.date || Date.now());
    return weekNumber(dt) === curW ? sum + (d.minutes || 0) : sum;
  }, 0);
  return { minutes, recommendedMinutes: 180 };
}
