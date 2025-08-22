import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

// Monthly average scores for a student across all subjects (last 7 months)
export async function getMonthlyAverageScores(studentId: string) {
  // assumes a submissions collection with fields: { studentId, score, createdAt }
  const q = query(collection(db, "submissions"), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  const byMonth: Record<string, { sum: number; n: number }> = {};

  snap.forEach(doc => {
    const d = doc.data() as any;
    const created = d.createdAt?.toDate ? d.createdAt.toDate() : new Date(d.createdAt || Date.now());
    const key = created.toLocaleString("en-US", { month: "short" });
    if (!byMonth[key]) byMonth[key] = { sum: 0, n: 0 };
    if (typeof d.score === "number") { byMonth[key].sum += d.score; byMonth[key].n += 1; }
  });

  const order = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return order
    .map(m => ({ month: m, avgScore: byMonth[m] ? Math.round(byMonth[m].sum / byMonth[m].n) : undefined }))
    .filter(x => x.avgScore !== undefined);
}

// Submission stats for a student
export async function getSubmissionStatsForStudent(studentId: string) {
  const q = query(collection(db, "submissions"), where("studentId", "==", studentId));
  const snap = await getDocs(q);
  let submitted = 0, missed = 0;
  snap.forEach(doc => {
    const d = doc.data() as any;
    if (d.status === "approved" || d.status === "pending" || d.status === "needsRevision") submitted += 1;
    else if (d.status === "missed") missed += 1;
  });
  return { submitted, missed };
}
