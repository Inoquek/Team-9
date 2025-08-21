import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Users, BookOpen, Bell, BarChart3, Calendar, CheckCircle, Clock } from "lucide-react";

interface TeacherDashboardProps {
  onNavigate: (page: "assignments" | "announcements") => void;
}

export const TeacherDashboard = ({ onNavigate }: TeacherDashboardProps) => {
  const [newAnnouncement, setNewAnnouncement] = useState({ title: "", content: "" });
  const [newAssignment, setNewAssignment] = useState({ title: "", description: "", dueDate: "" });

  // Demo data
  const classStats = {
    totalStudents: 24,
    assignmentsCompleted: 18,
    pendingAssignments: 6,
    parentEngagement: 92
  };

  const recentActivity = [
    { student: "Emma Johnson", activity: "Completed Letter Recognition", time: "10 minutes ago" },
    { student: "Liam Smith", activity: "Submitted Count to 10 Practice", time: "25 minutes ago" },
    { student: "Sophia Brown", activity: "Parent viewed Color Sorting Activity", time: "1 hour ago" },
    { student: "Noah Davis", activity: "Completed Show and Tell prep", time: "2 hours ago" }
  ];

  const handleCreateAnnouncement = () => {
    // Here you would normally save to database
    console.log("Creating announcement:", newAnnouncement);
    setNewAnnouncement({ title: "", content: "" });
  };

  const handleCreateAssignment = () => {
    // Here you would normally save to database
    console.log("Creating assignment:", newAssignment);
    setNewAssignment({ title: "", description: "", dueDate: "" });
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-6">
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Welcome back, Ms. Anderson! 👩‍🏫
        </h1>
        <p className="text-muted-foreground">
          Your kindergarten class is doing great! Here's what's happening today.
        </p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Dialog>
          <DialogTrigger asChild>
            <Button className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>New Assignment</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Assignment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="assignment-title">Assignment Title</Label>
                <Input
                  id="assignment-title"
                  value={newAssignment.title}
                  onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                  placeholder="e.g., Letter Recognition - F to J"
                />
              </div>
              <div>
                <Label htmlFor="assignment-description">Description</Label>
                <Textarea
                  id="assignment-description"
                  value={newAssignment.description}
                  onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                  placeholder="Describe the assignment and any special instructions..."
                />
              </div>
              <div>
                <Label htmlFor="due-date">Due Date</Label>
                <Input
                  id="due-date"
                  type="date"
                  value={newAssignment.dueDate}
                  onChange={(e) => setNewAssignment({...newAssignment, dueDate: e.target.value})}
                />
              </div>
              <Button onClick={handleCreateAssignment} className="w-full">
                Create Assignment
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="flex items-center space-x-2">
              <Bell className="h-4 w-4" />
              <span>New Announcement</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Announcement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="announcement-title">Title</Label>
                <Input
                  id="announcement-title"
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                  placeholder="e.g., Field Trip Next Friday"
                />
              </div>
              <div>
                <Label htmlFor="announcement-content">Message</Label>
                <Textarea
                  id="announcement-content"
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                  placeholder="Write your announcement here..."
                />
              </div>
              <Button onClick={handleCreateAnnouncement} className="w-full">
                Send Announcement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Class Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{classStats.totalStudents}</p>
                <p className="text-sm text-muted-foreground">Total Students</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-success">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-bold">{classStats.assignmentsCompleted}</p>
                <p className="text-sm text-muted-foreground">Completed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <Clock className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-bold">{classStats.pendingAssignments}</p>
                <p className="text-sm text-muted-foreground">Pending Review</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-accent">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <BarChart3 className="h-8 w-8 text-accent" />
              <div>
                <p className="text-2xl font-bold">{classStats.parentEngagement}%</p>
                <p className="text-sm text-muted-foreground">Parent Engagement</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onNavigate("assignments")}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 text-primary" />
              <span>Manage Assignments</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Create, edit, and track student assignments</p>
            <div className="mt-3 flex space-x-2">
              <Badge variant="secondary">3 Active</Badge>
              <Badge variant="outline">2 Due Soon</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onNavigate("announcements")}>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-warning" />
              <span>Announcements</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Share updates and reminders with parents</p>
            <div className="mt-3 flex space-x-2">
              <Badge variant="secondary">5 This Week</Badge>
              <Badge variant="outline">92% Read Rate</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-accent" />
            <span>Recent Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {recentActivity.map((activity, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
              <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0"></div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{activity.student}</p>
                <p className="text-sm text-muted-foreground">{activity.activity}</p>
              </div>
              <p className="text-xs text-muted-foreground">{activity.time}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};