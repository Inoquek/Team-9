import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Chart as ChartJS, ArcElement, BarElement, LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend } from "chart.js";
import { Bar, Pie, Line } from "react-chartjs-2";

ChartJS.register(ArcElement, BarElement, LineElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

type Status = "pending" | "completed" | "overdue";
type GradeValue = "Excellent" | "Good" | "Satisfactory" | "Needs Help";
type Subject = "Alphabet recognition" | "Vocabulary Knowledge" | "Phonemic Awareness" | "Point and Read";

interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  status: Status;
  subject: Subject;
  createdAt: string;
  child_id: string;
  submissions?: { submittedAt: string; grade?: { value: GradeValue } }[];
}

interface DayRow {
  date: string;
  minutes: number;
  tasks: number;
}

interface MetricsPageProps {
  userRole: "parent" | "teacher";
}

export const MetricsPage = ({ userRole }: MetricsPageProps) => {
  const [subject, setSubject] = useState<Subject>("Alphabet recognition");
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dailyStats, setDailyStats] = useState<DayRow[]>([]);

  const safeParse = <T,>(raw: string | null, fallback: T): T => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  useEffect(() => {
    const storedAssignments = safeParse<Assignment[]>(localStorage.getItem("assignments"), []);
    setAssignments(storedAssignments);
    const storedDailyStats = safeParse<DayRow[]>(localStorage.getItem("parent_daily_stats_v1"), []);
    setDailyStats(storedDailyStats);
  }, []);

  const demoScores = [
    { child_id: "1", child_name: "Emma Johnson", subject: "Alphabet recognition", score: 88, month: "Aug-2025", grade: "Excellent" },
    { child_id: "1", child_name: "Emma Johnson", subject: "Vocabulary Knowledge", score: 92, month: "Aug-2025", grade: "Good" },
    { child_id: "1", child_name: "Emma Johnson", subject: "Phonemic Awareness", score: 85, month: "Aug-2025", grade: "Satisfactory" },
    { child_id: "1", child_name: "Emma Johnson", subject: "Point and Read", score: 90, month: "Aug-2025", grade: "Excellent" },
    { child_id: "2", child_name: "Liam Smith", subject: "Alphabet recognition", score: 80, month: "Aug-2025", grade: "Good" },
    { child_id: "2", child_name: "Liam Smith", subject: "Vocabulary Knowledge", score: 85, month: "Aug-2025", grade: "Satisfactory" },
    { child_id: "2", child_name: "Liam Smith", subject: "Phonemic Awareness", score: 75, month: "Aug-2025", grade: "Satisfactory" },
    { child_id: "2", child_name: "Liam Smith", subject: "Point and Read", score: 82, month: "Aug-2025", grade: "Good" },
  ];

  const gradeToScore = (grade: GradeValue) => {
    switch (grade) {
      case "Excellent": return 90;
      case "Good": return 80;
      case "Satisfactory": return 70;
      case "Needs Help": return 60;
      default: return 0;
    }
  };

  const subjectPerformanceData = {
    labels: ["Alphabet recognition", "Vocabulary Knowledge", "Phonemic Awareness", "Point and Read"],
    datasets: [
      {
        label: userRole === "parent" ? "Your Child's Score" : "Class Average",
        data: userRole === "parent"
          ? demoScores.filter(d => d.child_id === "1").map(d => d.score)
          : demoScores.reduce((acc: Record<string, number>, d) => {
              acc[d.subject] = (acc[d.subject] || 0) + d.score / demoScores.filter(x => x.subject === d.subject).length;
              return acc;
            }, {} as Record<string, number>),
        backgroundColor: "#22c55e",
      },
      ...(userRole === "parent" ? [{
        label: "Class Average",
        data: demoScores.reduce((acc: Record<string, number>, d) => {
          acc[d.subject] = (acc[d.subject] || 0) + d.score / demoScores.filter(x => x.subject === d.subject).length;
          return acc;
        }, {} as Record<string, number>),
        backgroundColor: "#60a5fa",
      }] : []),
    ].map(dataset => ({
      ...dataset,
      data: ["Alphabet recognition", "Vocabulary Knowledge", "Phonemic Awareness", "Point and Read"].map(
        s => dataset.data[s] || 0
      ),
    })),
  };

  const engagementData = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    datasets: [
      {
        label: "Engagement Time (minutes)",
        data: dailyStats.reduce((acc: number[], _, i) => {
          if (i % 7 === 0) acc.push(dailyStats.slice(i, i + 7).reduce((sum, d) => sum + d.minutes, 0));
          return acc;
        }, []),
        backgroundColor: "#86efac",
      },
    ],
  };

  const submissionData = {
    labels: ["Submitted", "Pending", "Overdue"],
    datasets: [
      {
        data: [
          assignments.filter(a => a.status === "completed").length,
          assignments.filter(a => a.status === "pending").length,
          assignments.filter(a => a.status === "overdue").length,
        ],
        backgroundColor: ["#22c55e", "#facc15", "#ef4444"],
      },
    ],
  };

  const gradeImprovementData = {
    labels: ["Jun-2025", "Jul-2025", "Aug-2025"],
    datasets: [
      {
        label: "Average Score",
        data: ["Jun-2025", "Jul-2025", "Aug-2025"].map(month =>
          demoScores
            .filter(d => d.month === month && (userRole === "parent" ? d.child_id === "1" : true))
            .reduce((acc, d) => acc + gradeToScore(d.grade as GradeValue), 0) /
          Math.max(1, demoScores.filter(d => d.month === month && (userRole === "parent" ? d.child_id === "1" : true)).length)
        ),
        borderColor: "#22c55e",
        fill: false,
      },
    ],
  };

  const rankings = Array.from(new Set(demoScores.map(d => d.child_id))).map(child_id => {
    const childData = demoScores.filter(d => d.child_id === child_id);
    const avgScore = childData.reduce((sum, d) => sum + d.score, 0) / childData.length;
    return {
      child_id,
      child_name: childData[0].child_name,
      avgScore,
      subjects: childData.reduce((acc, d) => ({ ...acc, [d.subject]: d.score }), {} as Record<string, number>),
    };
  }).sort((a, b) => b.avgScore - a.avgScore);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">
        {userRole === "parent" ? "Your Child's Progress" : "Class Performance Metrics"}
      </h1>

      <div className="w-64">
        <Label htmlFor="subject">Select Subject</Label>
        <Select value={subject} onValueChange={setSubject}>
          <SelectTrigger id="subject">
            <SelectValue placeholder="Select subject" />
          </SelectTrigger>
          <SelectContent>
            {["Alphabet recognition", "Vocabulary Knowledge", "Phonemic Awareness", "Point and Read"].map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Subject Performance</CardTitle>
          </CardHeader>
          <CardContent>
            ```chartjs
            {
              "type": "bar",
              "data": {
                "labels": ["Alphabet recognition", "Vocabulary Knowledge", "Phonemic Awareness", "Point and Read"],
                "datasets": [
                  {
                    "label": "${userRole === 'parent' ? 'Your Child\\'s Score' : 'Class Average'}",
                    "data": ${JSON.stringify(subjectPerformanceData.datasets[0].data)},
                    "backgroundColor": "#22c55e"
                  }
                  ${userRole === "parent" ? `,{
                    "label": "Class Average",
                    "data": ${JSON.stringify(subjectPerformanceData.datasets[1].data)},
                    "backgroundColor": "#60a5fa"
                  }` : ""}
                ]
              },
              "options": {
                "plugins": {
                  "title": {
                    "display": true,
                    "text": "Subject Performance"
                  },
                  "legend": {
                    "position": "top"
                  },
                  "tooltip": {
                    "callbacks": {
                      "label": function(context) {
                        return context.dataset.label + ': ' + context.parsed.y;
                      }
                    }
                  }
                },
                "scales": {
                  "y": {
                    "beginAtZero": true,
                    "max": 100,
                    "title": {
                      "display": true,
                      "text": "Score"
                    }
                  }
                }
              }
            }
            ```
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Parent Engagement Time (Weekly)</CardTitle>
          </CardHeader>
          <CardContent>
            ```chartjs
            {
              "type": "bar",
              "data": {
                "labels": ["Week 1", "Week 2", "Week 3", "Week 4"],
                "datasets": [
                  {
                    "label": "Engagement Time (minutes)",
                    "data": ${JSON.stringify(engagementData.datasets[0].data)},
                    "backgroundColor": "#86efac"
                  }
                ]
              },
              "options": {
                "indexAxis": "y",
                "plugins": {
                  "title": {
                    "display": true,
                    "text": "Parent Engagement Time"
                  },
                  "legend": {
                    "position": "top"
                  },
                  "tooltip": {
                    "callbacks": {
                      "label": function(context) {
                        return context.dataset.label + ': ' + context.parsed.x + ' minutes';
                      }
                    }
                  }
                },
                "scales": {
                  "x": {
                    "title": {
                      "display": true,
                      "text": "Minutes"
                    }
                  }
                }
              }
            }
            ```
            <p className="text-sm text-muted-foreground mt-2">
              Recommended weekly engagement: 120 minutes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Submission Rate</CardTitle>
          </CardHeader>
          <CardContent>
            ```chartjs
            {
              "type": "pie",
              "data": {
                "labels": ["Submitted", "Pending", "Overdue"],
                "datasets": [
                  {
                    "data": ${JSON.stringify(submissionData.datasets[0].data)},
                    "backgroundColor": ["#22c55e", "#facc15", "#ef4444"]
                  }
                ]
              },
              "options": {
                "plugins": {
                  "title": {
                    "display": true,
                    "text": "Submission Rate"
                  },
                  "legend": {
                    "position": "top"
                  },
                  "tooltip": {
                    "callbacks": {
                      "label": function(context) {
                        let total = context.dataset.data.reduce((sum, val) => sum + val, 0);
                        let percentage = ((context.parsed / total) * 100).toFixed(1);
                        return context.label + ': ' + context.parsed + ' (' + percentage + '%)';
                      }
                    }
                  }
                }
              }
            }
            ```
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grade Improvement (Monthly)</CardTitle>
          </CardHeader>
          <CardContent>
            ```chartjs
            {
              "type": "line",
              "data": {
                "labels": ["Jun-2025", "Jul-2025", "Aug-2025"],
                "datasets": [
                  {
                    "label": "Average Score",
                    "data": ${JSON.stringify(gradeImprovementData.datasets[0].data)},
                    "borderColor": "#22c55e",
                    "fill": false
                  }
                ]
              },
              "options": {
                "plugins": {
                  "title": {
                    "display": true,
                    "text": "Grade Improvement"
                  },
                  "legend": {
                    "position": "top"
                  },
                  "tooltip": {
                    "callbacks": {
                      "label": function(context) {
                        return context.dataset.label + ': ' + context.parsed.y;
                      }
                    }
                  }
                },
                "scales": {
                  "y": {
                    "beginAtZero": true,
                    "max": 100,
                    "title": {
                      "display": true,
                      "text": "Score"
                    }
                  }
                }
              }
            }
            ```
          </CardContent>
        </Card>
      </div>

      {userRole === "teacher" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Subject-Wise Student Rankings</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student Name</TableHead>
                  <TableHead>Average Score</TableHead>
                  <TableHead>Alphabet Recognition</TableHead>
                  <TableHead>Vocabulary Knowledge</TableHead>
                  <TableHead>Phonemic Awareness</TableHead>
                  <TableHead>Point and Read</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rankings.map((student, index) => (
                  <TableRow key={student.child_id}>
                    <TableCell>{student.child_name} {index < 3 ? `🏅${index + 1}` : ''}</TableCell>
                    <TableCell>{student.avgScore.toFixed(1)}</TableCell>
                    <TableCell>{student.subjects["Alphabet recognition"]?.toFixed(1) || '-'}</TableCell>
                    <TableCell>{student.subjects["Vocabulary Knowledge"]?.toFixed(1) || '-'}</TableCell>
                    <TableCell>{student.subjects["Phonemic Awareness"]?.toFixed(1) || '-'}</TableCell>
                    <TableCell>{student.subjects["Point and Read"]?.toFixed(1) || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
