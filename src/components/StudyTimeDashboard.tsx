import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  Target, 
  TrendingUp, 
  Calendar, 
  BookOpen, 
  Trophy,
  BarChart3,
  CalendarDays
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { StudyTimeService } from '@/lib/services/studyTime';
import { DailyStudyStats, StudyTimeEntry } from '@/lib/types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from 'recharts';

interface StudyTimeDashboardProps {
  studentId: string;
  studentName: string;
}

type TimeRange = 'today' | 'week' | 'month';

export const StudyTimeDashboard: React.FC<StudyTimeDashboardProps> = ({
  studentId,
  studentName
}) => {
  const { toast } = useToast();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [todayStats, setTodayStats] = useState<StudyTimeEntry | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<DailyStudyStats[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<DailyStudyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load study time data
  useEffect(() => {
    const loadStudyTimeData = async () => {
      try {
        setIsLoading(true);
        
        // Load today's stats
        const today = await StudyTimeService.getTodayStudyTime(studentId);
        setTodayStats(today);
        
        // Load weekly stats
        const weekly = await StudyTimeService.getWeeklyStudyTime(studentId);
        setWeeklyStats(weekly);
        
        // Load current month stats
        const now = new Date();
        const monthly = await StudyTimeService.getMonthlyStudyTime(studentId, now.getFullYear(), now.getMonth() + 1);
        setMonthlyStats(monthly);
        
      } catch (error) {
        console.error('Error loading study time data:', error);
        toast({
          title: "Error",
          description: "Failed to load study time data. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadStudyTimeData();
  }, [studentId, toast]);

  // Subscribe to real-time updates for today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const unsubscribe = StudyTimeService.subscribeToStudyTimeUpdates(studentId, today, (entry) => {
      setTodayStats(entry);
    });

    return unsubscribe;
  }, [studentId]);

  const getCurrentStats = () => {
    switch (timeRange) {
      case 'today':
        return todayStats ? [{
          date: todayStats.date,
          totalMinutes: todayStats.totalMinutes,
          assignmentsCompleted: todayStats.assignmentsCompleted,
          averageTimePerAssignment: todayStats.assignmentsCompleted > 0 
            ? Math.round(todayStats.totalMinutes / todayStats.assignmentsCompleted) 
            : 0
        }] : [];
      case 'week':
        return weeklyStats;
      case 'month':
        return monthlyStats;
      default:
        return weeklyStats;
    }
  };

  const getGoalMinutes = () => {
    switch (timeRange) {
      case 'today':
        return 60; // 1 hour daily goal
      case 'week':
        return 300; // 5 hours weekly goal
      case 'month':
        return 1200; // 20 hours monthly goal
      default:
        return 60;
    }
  };

  const getProgressPercentage = (totalMinutes: number) => {
    const goal = getGoalMinutes();
    return Math.min((totalMinutes / goal) * 100, 100);
  };

  const getTotalMinutes = () => {
    const stats = getCurrentStats();
    return stats.reduce((sum, stat) => sum + stat.totalMinutes, 0);
  };

  const getTotalAssignments = () => {
    const stats = getCurrentStats();
    return stats.reduce((sum, stat) => sum + stat.assignmentsCompleted, 0);
  };

  const getAverageTimePerAssignment = () => {
    const totalMinutes = getTotalMinutes();
    const totalAssignments = getTotalAssignments();
    return totalAssignments > 0 ? Math.round(totalMinutes / totalAssignments) : 0;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (timeRange === 'today') {
      return 'Today';
    } else if (timeRange === 'week') {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getChartData = () => {
    const stats = getCurrentStats();
    return stats.map(stat => ({
      date: formatDate(stat.date),
      minutes: stat.totalMinutes,
      assignments: stat.assignmentsCompleted,
      average: stat.averageTimePerAssignment
    }));
  };

  const getStatusColor = (percentage: number) => {
    if (percentage >= 100) return 'text-green-600';
    if (percentage >= 75) return 'text-yellow-600';
    if (percentage >= 50) return 'text-orange-600';
    return 'text-red-600';
  };

  const getStatusIcon = (percentage: number) => {
    if (percentage >= 100) return <Trophy className="h-5 w-5 text-green-600" />;
    if (percentage >= 75) return <TrendingUp className="h-5 w-5 text-yellow-600" />;
    if (percentage >= 50) return <Target className="h-5 w-5 text-orange-600" />;
    return <Target className="h-5 w-5 text-red-600" />;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const currentStats = getCurrentStats();
  const totalMinutes = getTotalMinutes();
  const totalAssignments = getTotalAssignments();
  const averageTime = getAverageTimePerAssignment();
  const progressPercentage = getProgressPercentage(totalMinutes);
  const goalMinutes = getGoalMinutes();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Study Time Dashboard</h2>
          <p className="text-muted-foreground">
            Track {studentName}'s learning progress and study habits
          </p>
        </div>
        <Select value={timeRange} onValueChange={(value: TimeRange) => setTimeRange(value)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Study Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMinutes}m</div>
            <p className="text-xs text-muted-foreground">
              Goal: {goalMinutes}m
            </p>
            <Progress value={progressPercentage} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assignments Completed</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssignments}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === 'today' ? 'Today' : timeRange === 'week' ? 'This week' : 'This month'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Time/Assignment</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{averageTime}m</div>
            <p className="text-xs text-muted-foreground">
              Per completed assignment
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Progress Status</CardTitle>
            {getStatusIcon(progressPercentage)}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(progressPercentage)}`}>
              {Math.round(progressPercentage)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Goal completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Study Time Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          {currentStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getChartData()}>
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${value}${name === 'minutes' ? 'm' : name === 'assignments' ? '' : 'm'}`,
                    name === 'minutes' ? 'Study Time' : 
                    name === 'assignments' ? 'Assignments' : 'Average Time'
                  ]
                }
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
                <Bar dataKey="minutes" fill="hsl(var(--primary))" name="Study Time" />
                <ReferenceLine y={goalMinutes} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No study time data available for this period.</p>
              <p className="text-sm">Start tracking time when working on assignments!</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Breakdown */}
      {currentStats.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Daily Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {currentStats.map((stat, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-20 text-sm font-medium">
                      {formatDate(stat.date)}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {stat.totalMinutes}m
                      </span>
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3 w-3" />
                        {stat.assignmentsCompleted} assignments
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium">
                      {stat.averageTimePerAssignment}m avg
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getProgressPercentage(stat.totalMinutes).toFixed(0)}% of daily goal
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Encouragement */}
      {progressPercentage >= 100 && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="text-center">
              <Trophy className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                🎉 Amazing Progress!
              </h3>
              <p className="text-green-700">
                {studentName} has exceeded the {timeRange} goal! Keep up the great work!
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
