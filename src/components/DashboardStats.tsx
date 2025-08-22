import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Shield, BookOpen, Bell } from 'lucide-react';

interface DashboardStatsProps {
  stats: {
    totalUsers: number;
    parents: number;
    teachers: number;
    activeUsers: number;
  };
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="border-l-4 border-l-purple-500">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-purple-500" />
            <div>
              <p className="text-2xl font-bold">{stats.totalUsers}</p>
              <p className="text-sm text-muted-foreground">Total Users</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Shield className="h-8 w-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold">{stats.parents}</p>
              <p className="text-sm text-muted-foreground">Parents</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-green-500">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <BookOpen className="h-8 w-8 text-green-500" />
            <div>
              <p className="text-2xl font-bold">{stats.teachers}</p>
              <p className="text-sm text-muted-foreground">Teachers</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-orange-500">
        <CardContent className="p-4">
          <div className="flex items-center space-x-3">
            <Bell className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold">{stats.activeUsers}</p>
              <p className="text-sm text-muted-foreground">Active Users</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
