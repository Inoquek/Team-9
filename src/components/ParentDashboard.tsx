import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, BookOpen, Bell, Star, Clock, CheckCircle, AlertCircle } from "lucide-react";

interface ParentDashboardProps {
  onNavigate: (page: "assignments" | "announcements") => void;
}

export const ParentDashboard = ({ onNavigate }: ParentDashboardProps) => {
  // Demo data
  const recentAssignments = [
    { id: 1, title: "Letter Recognition - A to E", dueDate: "Today", status: "pending" },
    { id: 2, title: "Count to 10 Practice", dueDate: "Tomorrow", status: "completed" },
    { id: 3, title: "Color Sorting Activity", dueDate: "Dec 23", status: "pending" }
  ];

  const announcements = [
    { id: 1, title: "Holiday Party - Dec 22nd", type: "event", time: "2 hours ago" },
    { id: 2, title: "Picture Day Reminder", type: "reminder", time: "1 day ago" },
    { id: 3, title: "Show and Tell Friday", type: "activity", time: "2 days ago" }
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Good morning, Sarah! 👋
        </h1>
        <p className="text-muted-foreground">
          Emma has 2 assignments due this week and 1 new announcement.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <BookOpen className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Active Assignments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">5</p>
                <p className="text-sm text-muted-foreground">Completed This Week</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Bell className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">New Announcements</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Assignments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <span>Recent Assignments</span>
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onNavigate("assignments")}
          >
            View All
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentAssignments.map((assignment) => (
            <div key={assignment.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center space-x-3">
                {assignment.status === "completed" ? (
                  <CheckCircle className="h-5 w-5 text-success" />
                ) : (
                  <Clock className="h-5 w-5 text-warning" />
                )}
                <div>
                  <h4 className="font-medium text-foreground">{assignment.title}</h4>
                  <p className="text-sm text-muted-foreground">Due: {assignment.dueDate}</p>
                </div>
              </div>
              <Badge variant={assignment.status === "completed" ? "default" : "secondary"}>
                {assignment.status === "completed" ? "✅ Done" : "📝 Pending"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Recent Announcements */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Bell className="h-5 w-5 text-warning" />
            <span>Recent Announcements</span>
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => onNavigate("announcements")}
          >
            View All
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
              <div className="flex-shrink-0">
                {announcement.type === "event" && <Calendar className="h-5 w-5 text-primary" />}
                {announcement.type === "reminder" && <AlertCircle className="h-5 w-5 text-warning" />}
                {announcement.type === "activity" && <Star className="h-5 w-5 text-accent" />}
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground">{announcement.title}</h4>
                <p className="text-sm text-muted-foreground">{announcement.time}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};