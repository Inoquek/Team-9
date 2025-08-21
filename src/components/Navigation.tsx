import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Home, Bell, LogOut, User, Heart, Star } from "lucide-react";

interface NavigationProps {
  userRole: "parent" | "teacher";
  currentPage: "dashboard" | "assignments" | "announcements";
  onNavigate: (page: "dashboard" | "assignments" | "announcements") => void;
  onLogout: () => void;
}

export const Navigation = ({ userRole, currentPage, onNavigate, onLogout }: NavigationProps) => {
  const userName = userRole === "parent" ? "Sarah Johnson" : "Ms. Anderson";
  const userType = userRole === "parent" ? "Parent" : "Teacher";

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="relative">
              <BookOpen className="h-8 w-8 text-primary" />
              <Heart className="h-3 w-3 text-destructive absolute -top-0.5 -right-0.5" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Little Learners
              </h1>
              <p className="text-xs text-muted-foreground">Kindergarten Classroom</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-1">
            <Button
              variant={currentPage === "dashboard" ? "default" : "ghost"}
              onClick={() => onNavigate("dashboard")}
              className="flex items-center space-x-2"
            >
              <Home className="h-4 w-4" />
              <span>Dashboard</span>
            </Button>

            <Button
              variant={currentPage === "assignments" ? "default" : "ghost"}
              onClick={() => onNavigate("assignments")}
              className="flex items-center space-x-2"
            >
              <BookOpen className="h-4 w-4" />
              <span>Assignments</span>
              {userRole === "parent" && (
                <Badge variant="secondary" className="ml-1">2</Badge>
              )}
            </Button>

            <Button
              variant={currentPage === "announcements" ? "default" : "ghost"}
              onClick={() => onNavigate("announcements")}
              className="flex items-center space-x-2"
            >
              <Bell className="h-4 w-4" />
              <span>Announcements</span>
              {userRole === "parent" && (
                <Badge variant="destructive" className="ml-1">3</Badge>
              )}
            </Button>
          </div>

          {/* User Info & Logout */}
          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{userName}</p>
                <div className="flex items-center space-x-1">
                  <User className="h-3 w-3 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{userType}</p>
                  <Star className="h-3 w-3 text-warning" />
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="flex items-center space-x-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className="md:hidden pb-3">
          <div className="flex items-center justify-between space-x-1">
            <Button
              variant={currentPage === "dashboard" ? "default" : "ghost"}
              onClick={() => onNavigate("dashboard")}
              size="sm"
              className="flex-1"
            >
              <Home className="h-4 w-4" />
            </Button>

            <Button
              variant={currentPage === "assignments" ? "default" : "ghost"}
              onClick={() => onNavigate("assignments")}
              size="sm"
              className="flex-1 relative"
            >
              <BookOpen className="h-4 w-4" />
              {userRole === "parent" && (
                <Badge variant="secondary" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                  2
                </Badge>
              )}
            </Button>

            <Button
              variant={currentPage === "announcements" ? "default" : "ghost"}
              onClick={() => onNavigate("announcements")}
              size="sm"
              className="flex-1 relative"
            >
              <Bell className="h-4 w-4" />
              {userRole === "parent" && (
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs">
                  3
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};