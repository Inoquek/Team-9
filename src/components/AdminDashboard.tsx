import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, UserPlus, Shield, BookOpen, Bell, MessageSquare } from "lucide-react";
import { Class, Student, User } from "@/lib/types";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { UserManagement } from "./UserManagement";
import { DashboardStats } from "./DashboardStats";
import { ClassCreation } from "./ClassCreation";
import { UserCreation } from "./UserCreation";

interface AdminDashboardProps {
  onNavigate: (page: "assignments" | "announcements" | "forum") => void;
}

export const AdminDashboard = ({ onNavigate }: AdminDashboardProps) => {
  const { toast } = useToast();

  const [teachers, setTeachers] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);

  // View control state
  const [currentView, setCurrentView] = useState<'dashboard' | 'userManagement' | 'createClass' | 'createUser'>('dashboard');

  // Dynamic stats state
  const [stats, setStats] = useState({
    totalUsers: 0,
    parents: 0,
    teachers: 0,
    activeUsers: 0
  });

  // Load teachers and classes
  const loadTeachersAndClasses = async () => {
    try {
      // Load teachers (users with role 'teacher')
      const teachersQuery = query(
        collection(db, 'users'),
        where('role', '==', 'teacher'),
        where('isActive', '==', true)
      );
      const teachersSnapshot = await getDocs(teachersQuery);
      const teachersData = teachersSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })) as User[];
      setTeachers(teachersData);

      // Load classes with teacher names
      const classesQuery = query(
        collection(db, 'classes'),
        where('isActive', '==', true)
      );
      const classesSnapshot = await getDocs(classesQuery);
      const classesData = classesSnapshot.docs.map(doc => {
        const classData = doc.data();
        const teacher = teachersData.find(t => t.uid === classData.teacherId);
        return {
          id: doc.id,
          ...classData,
          teacherName: teacher ? teacher.displayName : 'Unknown'
        };
      });
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading teachers and classes:', error);
    }
  };

  // Load users and calculate stats
  const loadUsersAndStats = async () => {
    try {
      const usersQuery = query(collection(db, 'users'));
      const usersSnapshot = await getDocs(usersQuery);
      const usersData = usersSnapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      })).filter(user => (user as any).isActive !== false);

      // Calculate stats
      const totalUsers = usersData.length;
      const parents = usersData.filter((user: any) => user.role === 'parent').length;
      const teachers = usersData.filter((user: any) => user.role === 'teacher').length;
      const activeUsers = usersData.filter((user: any) => user.isActive !== false).length;

      setStats({
        totalUsers,
        parents,
        teachers,
        activeUsers
      });
    } catch (error) {
      console.error('Error loading users and stats:', error);
    }
  };

  // Add useEffect to load data when component mounts:
  useEffect(() => {
    loadTeachersAndClasses();
    loadUsersAndStats();
  }, []);

  // Add refresh function:
  const refreshData = async () => {
    await loadTeachersAndClasses();
    await loadUsersAndStats();
  };

  // Change teacher assignment
  const handleChangeTeacher = async (classId: string, newTeacherId: string) => {
    try {
      // Use Firebase updateDoc directly
      await updateDoc(doc(db, 'classes', classId), { teacherId: newTeacherId });
      toast({
        title: "Teacher Reassigned",
        description: "Teacher assignment updated successfully.",
      });
      await refreshData(); // Refresh to show changes
    } catch (error: any) {
      toast({
        title: "Teacher Reassignment Failed",
        description: error.message || "Something went wrong.",
        variant: "destructive"
      });
    }
  };

  // Remove teacher from class
  const handleRemoveTeacher = async (classId: string, teacherId: string) => {
    try {
      // Use Firebase updateDoc directly
      await updateDoc(doc(db, 'classes', classId), { teacherId: null });
      toast({
        title: "Teacher Removed",
        description: "Teacher removed from class successfully.",
      });
      await refreshData(); // Refresh to show changes
    } catch (error: any) {
      toast({
        title: "Teacher Removal Failed",
        description: error.message || "Something went wrong.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-xl sm:rounded-2xl p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          Welcome, Admin! 👑
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage users, monitor system, and oversee the KindyReach platform.
        </p>
      </div>

      {/* Quick Stats */}
      <DashboardStats stats={stats} />

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <Button 
          className="flex items-center space-x-2 h-10 text-sm"
          onClick={() => setCurrentView('createClass')}
          variant={currentView === 'createClass' ? 'default' : 'outline'}
        >
          <BookOpen className="h-4 w-4" />
          <span>Create New Class</span>
        </Button>

        <Button 
          className="flex items-center space-x-2 h-10 text-sm"
          onClick={() => setCurrentView('createUser')}
          variant={currentView === 'createUser' ? 'default' : 'outline'}
        >
          <UserPlus className="h-4 w-4" />
          <span>Create New User</span>
        </Button>

        <Button 
          className="flex items-center space-x-2 h-10 text-sm"
          onClick={() => setCurrentView('userManagement')}
          variant={currentView === 'userManagement' ? 'default' : 'outline'}
        >
          <Users className="h-4 w-4" />
          <span>Manage Users</span>
        </Button>

      </div>

      {/* Quick Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onNavigate("assignments")}>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span>Assignment Management</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-xs sm:text-sm text-muted-foreground">Monitor and manage all assignments across the platform</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onNavigate("announcements")}>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
              <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-warning" />
              <span>System Announcements</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-xs sm:text-sm text-muted-foreground">Send platform-wide announcements and updates</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => onNavigate("forum")}>
          <CardHeader className="p-3 sm:p-4">
            <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              <span>Community Forum</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <p className="text-xs sm:text-sm text-muted-foreground">Join discussions and share insights with the community</p>
          </CardContent>
        </Card>


      </div>

      {/* Content Area */}
      <Card>
        <CardHeader className="p-3 sm:p-4">
          <CardTitle className="flex items-center justify-between text-base sm:text-lg">
            <span>
              {currentView === 'userManagement' ? 'User Management' : 
               currentView === 'createClass' ? 'Create New Class' :
               currentView === 'createUser' ? 'Create New User' : 'Admin Tools'}
            </span>
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
        <CardContent className="p-3 sm:p-4">
          {currentView === 'userManagement' ? (
            <UserManagement classes={classes} />
          ) : currentView === 'createClass' ? (
            <ClassCreation 
              teachers={teachers} 
              onSuccess={() => {
                refreshData();
                setCurrentView('dashboard');
              }} 
            />
          ) : currentView === 'createUser' ? (
            <UserCreation 
              classes={classes} 
              onSuccess={() => {
                refreshData();
                setCurrentView('dashboard');
              }} 
            />
          ) : (
            <div className="text-center py-6 sm:py-8 text-muted-foreground">
              <Users className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-50" />
              <p className="text-base sm:text-lg">Choose an action above to get started</p>
              <p className="text-xs sm:text-sm">Create classes, manage users, or view system reports</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};