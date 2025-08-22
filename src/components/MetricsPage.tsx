import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, PieChart, TrendingUp } from 'lucide-react';
import { BarChart, Bar, PieChart as RechartsPieChart, Pie, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';

interface MetricsPageProps {
  userRole: 'parent' | 'teacher' | 'admin';
}

export const MetricsPage: React.FC<MetricsPageProps> = ({ userRole }) => {
  const { user } = useAuth();
  const isParent = userRole === 'parent';
  const isTeacher = userRole === 'teacher';

  const barData = isParent
    ? [
        { name: 'Math', value: 85 },
        { name: 'Reading', value: 90 },
        { name: 'Science', value: 78 },
      ]
    : [
        { name: 'Class A', value: 82 },
        { name: 'Class B', value: 88 },
        { name: 'Class C', value: 75 },
      ];

  const pieData = isParent
    ? [
        { name: 'Completed', value: 70 },
        { name: 'Pending', value: 20 },
        { name: 'Missed', value: 10 },
      ]
    : [
        { name: 'High', value: 40 },
        { name: 'Medium', value: 35 },
        { name: 'Low', value: 25 },
      ];

  const lineData = isParent
    ? [
        { name: 'Week 1', value: 80 },
        { name: 'Week 2', value: 82 },
        { name: 'Week 3', value: 85 },
        { name: 'Week 4', value: 90 },
      ]
    : [
        { name: 'Week 1', value: 70 },
        { name: 'Week 2', value: 75 },
        { name: 'Week 3', value: 78 },
        { name: 'Week 4', value: 80 },
      ];

  const rankings = isParent
    ? [
        { name: 'Child 1', score: 95, rank: 1 },
        { name: 'Child 2', score: 90, rank: 2 },
        { name: 'Child 3', score: 85, rank: 3 },
      ]
    : [
        { name: 'Student A', score: 92, rank: 1 },
        { name: 'Student B', score: 88, rank: 2 },
        { name: 'Student C', score: 85, rank: 3 },
      ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">
        {isParent ? 'Child Performance Metrics' : isTeacher ? 'Class Performance Metrics' : 'Platform Metrics'}
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="h-5 w-5 mr-2" />
              {isParent ? 'Subject Performance' : 'Class Averages'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="h-5 w-5 mr-2" />
              {isParent ? 'Assignment Status' : 'Performance Distribution'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RechartsPieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} fill="#10b981" label />
                <Tooltip />
                <Legend />
              </RechartsPieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              {isParent ? 'Progress Over Time' : 'Engagement Trends'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="value" stroke="#3b82f6" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="h-5 w-5 mr-2" />
              {isParent ? 'Child Rankings' : 'Student Rankings'}
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
      </div>
    </div>
  );
};