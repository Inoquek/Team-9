import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, PieChart, TrendingUp, Clock } from 'lucide-react';
import { BarChart, Bar, PieChart as RechartsPieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

interface MetricsPageProps {
  userRole: 'parent' | 'teacher' | 'admin';
}

export const MetricsPage: React.FC<MetricsPageProps> = ({ userRole }) => {
  const { user } = useAuth();
  const isParent = userRole === 'parent';
  const isTeacherOrAdmin = userRole === 'teacher' || userRole === 'admin';

  // Data for subject performance (parent: child vs. class average; teacher/admin: class averages)
  const subjectData = isParent
    ? [
        { subject: 'Alphabet Recognition', child: 85, classAvg: 80 },
        { subject: 'Sight Word Recognition', child: 90, classAvg: 85 },
        { subject: 'Vocabulary', child: 78, classAvg: 82 },
        { subject: 'Point and Read', child: 88, classAvg: 79 },
        { subject: 'Phonemic Awareness', child: 82, classAvg: 84 },
      ]
    : [
        { subject: 'Alphabet Recognition', classAvg: 80 },
        { subject: 'Sight Word Recognition', classAvg: 85 },
        { subject: 'Vocabulary', classAvg: 82 },
        { subject: 'Point and Read', classAvg: 79 },
        { subject: 'Phonemic Awareness', classAvg: 84 },
      ];

  // Data for submission rate (parent only)
  const submissionData = isParent
    ? [
        { name: 'Submitted', value: 80 },
        { name: 'Missed', value: 20 },
      ]
    : [];

  // Data for grade improvement (parent only)
  const gradeData = isParent
    ? [
        { month: 'Jan', score: 82 },
        { month: 'Feb', score: 84 },
        { month: 'Mar', score: 85 },
        { month: 'Apr', score: 83 },
      ]
    : [];

  // Data for parent engagement time (parent only, static for now)
  const engagementTime = isParent ? 3.5 : 0; // Hours per week
  const recommendedTime = 5; // Recommended hours per week

  // Data for rankings (teacher/admin only)
  const rankings = isTeacherOrAdmin
    ? [
        { name: 'Student A', score: 92, rank: 1 },
        { name: 'Student B', score: 88, rank: 2 },
        { name: 'Student C', score: 85, rank: 3 },
      ]
    : [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        {isParent ? 'Child Performance Metrics' : 'Class Performance Metrics'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              {isParent ? 'Subject Performance (Child vs. Class)' : 'Class Averages'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={subjectData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="subject" />
                <YAxis />
                <Tooltip />
                <Legend />
                {isParent && <Bar dataKey="child" name="Your Child" fill="#3b82f6" />}
                <Bar dataKey="classAvg" name="Class Average" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        {isParent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <PieChart className="h-5 w-5 mr-2" />
                Assignment Submission Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <RechartsPieChart>
                  <Pie data={submissionData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#10b981" label />
                  <Tooltip />
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {isParent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Grade Improvement Over Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={gradeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="score" name="Average Score" stroke="#3b82f6" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
        {isParent && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Parent Engagement Time
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold">{engagementTime} hours/week</p>
              <p className="text-sm text-muted-foreground">
                Recommended: {recommendedTime} hours/week to support your child’s learning.
              </p>
            </CardContent>
          </Card>
        )}
        {isTeacherOrAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                Student Rankings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b">
                    <th className="pb-2">Rank</th>
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((item) => (
                    <tr key={item.rank} className="border-b">
                      <td className="py-2">{item.rank}</td>
                      <td className="py-2">{item.name}</td>
                      <td className="py-2">{item.score}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};