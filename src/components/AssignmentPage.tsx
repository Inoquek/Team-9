import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BookOpen, Calendar, Clock, CheckCircle, Plus, Edit, Trash2, Eye, Users } from "lucide-react";

interface AssignmentPageProps {
  userRole: "parent" | "teacher";
}

export const AssignmentPage = ({ userRole }: AssignmentPageProps) => {
  const [filterStatus, setFilterStatus] = useState("all");
  const [newAssignment, setNewAssignment] = useState({
    title: "",
    description: "",
    dueDate: "",
    subject: ""
  });

  // Demo assignments data
  const assignments = [
    {
      id: 1,
      title: "Letter Recognition - A to E",
      description: "Practice identifying and writing letters A through E. Use the worksheet provided and practice writing each letter 3 times.",
      dueDate: "2024-12-25",
      status: "pending",
      subject: "Language Arts",
      completedBy: userRole === "teacher" ? 18 : undefined,
      totalStudents: userRole === "teacher" ? 24 : undefined,
      createdAt: "2024-12-20"
    },
    {
      id: 2,
      title: "Count to 10 Practice",
      description: "Count objects around the house and write the numbers. Take photos of your counting practice to share!",
      dueDate: "2024-12-24",
      status: "completed",
      subject: "Math",
      completedBy: userRole === "teacher" ? 22 : undefined,
      totalStudents: userRole === "teacher" ? 24 : undefined,
      createdAt: "2024-12-18"
    },
    {
      id: 3,
      title: "Color Sorting Activity",
      description: "Sort household items by color. Practice naming colors and create groups of the same colored items.",
      dueDate: "2024-12-27",
      status: "pending",
      subject: "Science",
      completedBy: userRole === "teacher" ? 5 : undefined,
      totalStudents: userRole === "teacher" ? 24 : undefined,
      createdAt: "2024-12-21"
    },
    {
      id: 4,
      title: "Holiday Card Making",
      description: "Create a holiday card for someone special using art supplies. Focus on drawing and writing practice.",
      dueDate: "2024-12-30",
      status: "pending",
      subject: "Art",
      completedBy: userRole === "teacher" ? 12 : undefined,
      totalStudents: userRole === "teacher" ? 24 : undefined,
      createdAt: "2024-12-22"
    }
  ];

  const filteredAssignments = assignments.filter(assignment => {
    if (filterStatus === "all") return true;
    return assignment.status === filterStatus;
  });

  const handleCreateAssignment = () => {
    console.log("Creating assignment:", newAssignment);
    setNewAssignment({ title: "", description: "", dueDate: "", subject: "" });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "success";
      case "pending": return "warning";
      case "overdue": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4" />;
      case "pending": return <Clock className="h-4 w-4" />;
      default: return <BookOpen className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {userRole === "parent" ? "Emma's Assignments" : "Class Assignments"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {userRole === "parent" 
              ? "Track your child's learning activities and progress"
              : "Manage and track all class assignments"
            }
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {/* Filter */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignments</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          {/* Create Assignment (Teacher only) */}
          {userRole === "teacher" && (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>New Assignment</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Assignment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="assignment-title">Title</Label>
                    <Input
                      id="assignment-title"
                      value={newAssignment.title}
                      onChange={(e) => setNewAssignment({...newAssignment, title: e.target.value})}
                      placeholder="e.g., Shape Recognition Activity"
                    />
                  </div>
                  <div>
                    <Label htmlFor="assignment-subject">Subject</Label>
                    <Select onValueChange={(value) => setNewAssignment({...newAssignment, subject: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select subject" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Math">Math</SelectItem>
                        <SelectItem value="Language Arts">Language Arts</SelectItem>
                        <SelectItem value="Science">Science</SelectItem>
                        <SelectItem value="Art">Art</SelectItem>
                        <SelectItem value="Social Studies">Social Studies</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="assignment-description">Description</Label>
                    <Textarea
                      id="assignment-description"
                      value={newAssignment.description}
                      onChange={(e) => setNewAssignment({...newAssignment, description: e.target.value})}
                      placeholder="Describe the assignment and any special instructions..."
                      rows={3}
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
          )}
        </div>
      </div>

      {/* Assignment Stats (Teacher only) */}
      {userRole === "teacher" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{assignments.length}</p>
                  <p className="text-sm text-muted-foreground">Total Assignments</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <CheckCircle className="h-8 w-8 text-success" />
                <div>
                  <p className="text-2xl font-bold">
                    {assignments.filter(a => a.status === "completed").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Clock className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-2xl font-bold">
                    {assignments.filter(a => a.status === "pending").length}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-accent">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-accent" />
                <div>
                  <p className="text-2xl font-bold">89%</p>
                  <p className="text-sm text-muted-foreground">Completion Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Assignments List */}
      <div className="grid gap-4">
        {filteredAssignments.map((assignment) => (
          <Card key={assignment.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <CardTitle className="text-lg">{assignment.title}</CardTitle>
                    <Badge variant={getStatusColor(assignment.status)} className="flex items-center space-x-1">
                      {getStatusIcon(assignment.status)}
                      <span className="capitalize">{assignment.status}</span>
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-4 w-4" />
                      <span>Due: {new Date(assignment.dueDate).toLocaleDateString()}</span>
                    </div>
                    <Badge variant="outline">{assignment.subject}</Badge>
                    {userRole === "teacher" && (
                      <div className="flex items-center space-x-1">
                        <Users className="h-4 w-4" />
                        <span>{assignment.completedBy}/{assignment.totalStudents} completed</span>
                      </div>
                    )}
                  </div>
                </div>

                {userRole === "teacher" && (
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{assignment.description}</p>
              
              {userRole === "teacher" && (
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Completion Progress</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round((assignment.completedBy! / assignment.totalStudents!) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 mt-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(assignment.completedBy! / assignment.totalStudents!) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {userRole === "parent" && assignment.status === "pending" && (
                <Button className="w-full sm:w-auto">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Mark as Complete
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAssignments.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No assignments found</h3>
            <p className="text-muted-foreground">
              {filterStatus === "all" 
                ? "No assignments have been created yet."
                : `No ${filterStatus} assignments found.`
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};