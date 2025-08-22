import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, BookOpen, Bell, BarChart3, Calendar, CheckCircle, Clock, ChevronRight, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { AssignmentCreation } from "./AssignmentCreation";
import { AnnouncementCreation } from "./AnnouncementCreation";
import { AssignmentService } from "@/lib/services/assignments";
import { AnnouncementService } from "@/lib/services/announcements";
import { Assignment, Announcement } from "@/lib/types";

interface TeacherDashboardProps {
  onNavigate: (page: "assignments" | "announcements") => void;
}

interface TeacherClass {
  id: string;
  name: string;
  grade: string;
  studentCount: number;
  isActive: boolean;
}

export const TeacherDashboard = ({ onNavigate }: TeacherDashboardProps) => {
  const { user } = useAuth();
  const [selectedClass, setSelectedClass] = useState<TeacherClass | null>(null);
  const [teacherClasses, setTeacherClasses] = useState<TeacherClass[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  
  // View control state
  const [currentView, setCurrentView] = useState<'dashboard' | 'createAssignment' | 'createAnnouncement'>('dashboard');
  
  // Real data states
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  const { toast } = useToast();

  // Load teacher's classes
  useEffect(() => {
    const loadTeacherClasses = async () => {
      if (!user?.uid) return;
      
      setIsLoadingClasses(true);
      try {
        const classesQuery = query(
          collection(db, 'classes'),
          where('teacherId', '==', user.uid),
          where('isActive', '==', true)
        );
        const classesSnapshot = await getDocs(classesQuery);
        
        // Get student counts for each class
        const classesData = await Promise.all(
          classesSnapshot.docs.map(async (doc) => {
            const classData = doc.data();
            const classId = doc.id;
            
            // Query students collection to get actual student count
            let studentCount = 0;
            try {
              console.log(`Getting student count for class: ${classId} (${classData.name})`);
              
              const studentsQuery = query(
                collection(db, 'students'),
                where('classId', '==', classId),
                where('isActive', '==', true)
              );
              const studentsSnapshot = await getDocs(studentsQuery);
              studentCount = studentsSnapshot.size;
              
              console.log(`Found ${studentCount} active students in class ${classId}`);
              
              // Debug: Log some student data
              if (studentCount > 0) {
                studentsSnapshot.docs.forEach((studentDoc, index) => {
                  const studentData = studentDoc.data();
                  console.log(`Student ${index + 1}:`, {
                    id: studentDoc.id,
                    name: studentData.name,
                    classId: studentData.classId,
                    isActive: studentData.isActive
                  });
                });
              }
            } catch (error) {
              console.error(`Error getting student count for class ${classId}:`, error);
              // Fallback to stored count if available
              studentCount = classData.students?.length || 0;
              console.log(`Fallback student count: ${studentCount}`);
            }
            
            return {
              id: classId,
              name: classData.name,
              grade: classData.grade,
              studentCount: studentCount,
              isActive: classData.isActive
            };
          })
        );
        
        setTeacherClasses(classesData);
        
        // Set first class as selected by default
        if (classesData.length > 0 && !selectedClass) {
          setSelectedClass(classesData[0]);
        }
      } catch (error) {
        console.error('Error loading teacher classes:', error);
      } finally {
        setIsLoadingClasses(false);
      }
    };

    loadTeacherClasses();
  }, [user?.uid]);

  // Load class data when selectedClass changes
  useEffect(() => {
    if (selectedClass) {
      loadClassData(selectedClass.id);
    }
  }, [selectedClass]);

  // Load assignments and announcements for selected class
  const loadClassData = async (classId: string) => {
    setIsLoadingData(true);
    try {
      const [assignmentsData, announcementsData] = await Promise.all([
        AssignmentService.getClassAssignments(classId),
        AnnouncementService.getClassAnnouncements(classId)
      ]);
      
      setAssignments(assignmentsData);
      setAnnouncements(announcementsData);
    } catch (error) {
      console.error('Error loading class data:', error);
      toast({
        title: "Error Loading Data",
        description: "Failed to load assignments and announcements.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingData(false);
    }
  };

  // Calculate real statistics from data
  const classStats = {
    totalStudents: selectedClass?.studentCount || 0,
    activeAssignments: assignments.filter(a => a.status === 'active').length,
    totalAnnouncements: announcements.length,
    parentEngagement: 92 // TODO: Calculate real engagement rate
  };

  // Helper function to format time ago (use useCallback to prevent re-renders)
  const formatTimeAgo = React.useCallback((date: any) => {
    try {
      let actualDate: Date;
      
      // Handle Firestore Timestamp
      if (date && typeof date === 'object' && date.toDate) {
        actualDate = date.toDate();
      }
      // Handle Date object
      else if (date instanceof Date) {
        actualDate = date;
      }
      // Handle string dates
      else if (typeof date === 'string') {
        actualDate = new Date(date);
      }
      // Fallback
      else {
        return 'Unknown time';
      }

      const now = new Date();
      const diffInMs = now.getTime() - actualDate.getTime();
      const diffInMins = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

      if (diffInMins < 1) {
        return 'Just now';
      } else if (diffInMins < 60) {
        return `${diffInMins} minutes ago`;
      } else if (diffInHours < 24) {
        return `${diffInHours} hours ago`;
      } else {
        return `${diffInDays} days ago`;
      }
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Unknown time';
    }
  }, []);

  // Generate recent activity from assignments and announcements
  const recentActivity = React.useMemo(() => {
    const activities: Array<{
      title: string;
      type: 'assignment' | 'announcement';
      time: string;
      createdAt: Date;
    }> = [];

    // Add recent assignments
    assignments.slice(0, 3).forEach(assignment => {
      activities.push({
        title: `Assignment: ${assignment.title}`,
        type: 'assignment',
        time: formatTimeAgo(assignment.createdAt),
        createdAt: assignment.createdAt
      });
    });

    // Add recent announcements
    announcements.slice(0, 3).forEach(announcement => {
      activities.push({
        title: `Announcement: ${announcement.title}`,
        type: 'announcement',
        time: formatTimeAgo(announcement.createdAt),
        createdAt: announcement.createdAt
      });
    });

    // Sort by creation date and take the 6 most recent
    return activities
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [assignments, announcements, formatTimeAgo]);

  const handleSuccess = () => {
    setCurrentView('dashboard');
    // Refresh data after successful creation
    if (selectedClass) {
      loadClassData(selectedClass.id);
    }
  };

  const getViewTitle = () => {
    switch (currentView) {
      case 'createAssignment': return 'Create New Assignment';
      case 'createAnnouncement': return 'Create New Announcement';
      default: return 'Admin Tools';
    }
  };

  return (
    <div className="flex gap-6">
      {/* Sidebar with Classes */}
      <div className="w-64 flex-shrink-0">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">My Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {isLoadingClasses ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>Loading classes...</p>
              </div>
            ) : teacherClasses.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>No classes assigned</p>
              </div>
            ) : (
              teacherClasses.map((cls) => (
                <Button
                  key={cls.id}
                  variant={selectedClass?.id === cls.id ? "default" : "ghost"}
                  className="w-full justify-between"
                  onClick={() => setSelectedClass(cls)}
                >
                  <div className="text-left">
                    <p className="font-medium">{cls.name}</p>
                    <p className="text-xs text-muted-foreground">Grade {cls.grade}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="text-xs">
                      {cls.studentCount} students
                    </Badge>
                    <ChevronRight className="h-4 w-4" />
                  </div>
                </Button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Welcome Section */}
        <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl p-6">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Welcome back, {user?.displayName || 'Teacher'}! 👩‍🏫
          </h1>
          <p className="text-muted-foreground">
            {selectedClass ? (
              <>
                Your <strong>{selectedClass.name}</strong> class is doing great! Here's what's happening today.
              </>
            ) : (
              "Select a class to view details and manage your students."
            )}
          </p>
        </div>

        {/* Class Selection Notice */}
        {!selectedClass && (
          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <BookOpen className="h-8 w-8 text-warning" />
                <div>
                  <p className="font-medium">No Class Selected</p>
                  <p className="text-sm text-muted-foreground">
                    Please select a class from the sidebar to view class-specific information and manage assignments.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions - Only show when class is selected and on dashboard view */}
        {selectedClass && currentView === 'dashboard' && (
          <div className="flex flex-wrap gap-3">
            <Button 
              className="flex items-center space-x-2"
              onClick={() => setCurrentView('createAssignment')}
            >
              <Plus className="h-4 w-4" />
              <span>New Assignment</span>
            </Button>

            <Button 
              variant="outline" 
              className="flex items-center space-x-2"
              onClick={() => setCurrentView('createAnnouncement')}
            >
              <Bell className="h-4 w-4" />
              <span>New Announcement</span>
            </Button>
          </div>
        )}

        {/* Content Area */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{getViewTitle()}</span>
              {currentView !== 'dashboard' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('dashboard')}
                  className="h-8 w-8 p-0 hover:bg-muted"
                >
                  <span className="text-lg">×</span>
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentView === 'createAssignment' && selectedClass ? (
              <AssignmentCreation 
                classId={selectedClass.id}
                className={selectedClass.name}
                onSuccess={handleSuccess}
                onCancel={() => setCurrentView('dashboard')}
              />
            ) : currentView === 'createAnnouncement' && selectedClass ? (
              <AnnouncementCreation 
                classId={selectedClass.id}
                className={selectedClass.name}
                onSuccess={handleSuccess}
                onCancel={() => setCurrentView('dashboard')}
              />
            ) : (
              <>
                {/* Dashboard Content - Only show when class is selected */}
                {selectedClass ? (
                  <div className="space-y-6">
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
                            <BookOpen className="h-8 w-8 text-success" />
                            <div>
                              <p className="text-2xl font-bold">{classStats.activeAssignments}</p>
                              <p className="text-sm text-muted-foreground">Active Assignments</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-l-4 border-l-warning">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3">
                            <Bell className="h-8 w-8 text-warning" />
                            <div>
                              <p className="text-2xl font-bold">{classStats.totalAnnouncements}</p>
                              <p className="text-sm text-muted-foreground">Announcements</p>
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
                            <Badge variant="secondary">{classStats.activeAssignments} Active</Badge>
                            <Badge variant="outline">View All</Badge>
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
                            <Badge variant="secondary">{classStats.totalAnnouncements} Total</Badge>
                            <Badge variant="outline">View All</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Recent Activity */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Calendar className="h-5 w-5 text-accent" />
                          <span>Recent Activity - {selectedClass.name}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {isLoadingData ? (
                          <div className="text-center py-4 text-muted-foreground">
                            <p>Loading recent activity...</p>
                          </div>
                        ) : recentActivity.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground">
                            <p>No recent activity yet</p>
                            <p className="text-sm">Create assignments and announcements to see activity here</p>
                          </div>
                        ) : (
                          recentActivity.map((activity, index) => (
                            <div key={index} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                activity.type === 'assignment' ? 'bg-blue-500' : 'bg-amber-500'
                              }`}></div>
                              <div className="flex-1">
                                <p className="font-medium text-foreground">{activity.title}</p>
                                <p className="text-sm text-muted-foreground">
                                  {activity.type === 'assignment' ? 'Assignment created' : 'Announcement posted'}
                                </p>
                              </div>
                              <p className="text-xs text-muted-foreground">{activity.time}</p>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg">Select a class to view details and manage your students</p>
                    <p className="text-sm">Choose from the classes in the sidebar to get started</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};