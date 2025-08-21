import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Home, Bell, LogOut, User, Heart, Star } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  userRole: "parent" | "teacher";
  currentPage: "dashboard" | "assignments" | "announcements";
  onNavigate: (page: "dashboard" | "assignments" | "announcements") => void;
  onLogout: () => void;
}

export const AppSidebar = ({ userRole, currentPage, onNavigate, onLogout }: AppSidebarProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const userName = userRole === "parent" ? "Sarah Johnson" : "Ms. Anderson";
  const userType = userRole === "parent" ? "Parent" : "Teacher";

  const navigationItems = [
    {
      title: "Dashboard",
      page: "dashboard" as const,
      icon: Home,
      badge: null,
    },
    {
      title: "Assignments", 
      page: "assignments" as const,
      icon: BookOpen,
      badge: userRole === "parent" ? 2 : null,
    },
    {
      title: "Announcements",
      page: "announcements" as const, 
      icon: Bell,
      badge: userRole === "parent" ? 3 : null,
    },
  ];

  return (
    <Sidebar collapsible="icon">
      {/* Header with Logo */}
      <SidebarHeader className="border-b border-border p-4">
        <div className="flex items-center space-x-3">
          <div className="relative flex-shrink-0">
            <BookOpen className="h-8 w-8 text-primary" />
            <Heart className="h-3 w-3 text-destructive absolute -top-0.5 -right-0.5" />
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent truncate">
                Little Learners
              </h1>
              <p className="text-xs text-muted-foreground">Kindergarten Classroom</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      {/* Navigation Content */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className={isCollapsed ? "sr-only" : ""}>
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.page}>
                  <SidebarMenuButton
                    onClick={() => onNavigate(item.page)}
                    isActive={currentPage === item.page}
                    className="w-full justify-start"
                  >
                    <item.icon className="h-4 w-4" />
                    {!isCollapsed && (
                      <>
                        <span>{item.title}</span>
                        {item.badge && (
                          <Badge variant="destructive" className="ml-auto h-5 w-5 p-0 text-xs flex items-center justify-center">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                    {isCollapsed && item.badge && (
                      <Badge variant="destructive" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-xs flex items-center justify-center">
                        {item.badge}
                      </Badge>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer with User Info and Logout */}
      <SidebarFooter className="border-t border-border p-4">
        {!isCollapsed && (
          <div className="space-y-3">
            {/* User Info */}
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{userName}</p>
                <div className="flex items-center space-x-1">
                  <p className="text-xs text-muted-foreground">{userType}</p>
                  <Star className="h-3 w-3 text-warning" />
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="w-full justify-start"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        )}

        {isCollapsed && (
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <User className="h-4 w-4 text-primary" />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onLogout}
              className="w-full p-2"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
};

interface TopBarProps {
  userRole: "parent" | "teacher";
}

export const TopBar = ({ userRole }: TopBarProps) => {
  return (
    <header className="h-12 flex items-center border-b border-border bg-card px-4">
      <SidebarTrigger className="mr-4" />
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-foreground">
          {userRole === "parent" ? "Parent Portal" : "Teacher Dashboard"}
        </h2>
      </div>
    </header>
  );
};