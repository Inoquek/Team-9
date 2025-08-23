import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

type SubjectPerf = { subject: string; childAvg: number; classAvg: number };
type ClassRankingRow = { studentId: string; studentName: string; subject: string; rank: number; avgScore: number };

// Child vs class averages per subject
export async function getSubjectAveragesForStudent(studentId: string, classId?: string): Promise<SubjectPerf[]> {
  const subj = ["Math","Science","Reading","Writing","Art"];
  if (!classId) return subj.map(s => ({ subject: s, childAvg: 0, classAvg: 0 }));

  // assumes submissions with { studentId, classId, subject, score }
  const q = query(collection(db, "submissions"), where("classId","==",classId));
  const snap = await getDocs(q);

  const agg: Record<string, { sum: number; n: number; childSum: number; childN: number }> = {};
  subj.forEach(s => agg[s] = { sum: 0, n: 0, childSum: 0, childN: 0 });

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
  // assumes submissions with { classId, studentId, studentName, subject, score }
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
