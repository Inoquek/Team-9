import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Home, Bell, LogOut, User, Heart, Star, TrendingUp, Sprout, MessageSquare } from "lucide-react"; // 添加MessageSquare

import { useAuth } from "@/contexts/AuthContext";
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
import { User as UserType } from "@/lib/types";

interface AppSidebarProps {
  user: UserType;
  currentPage: "dashboard" | "assignments" | "announcements" | "metrics" | "parentGarden" | "forum"; // 添加forum
  onNavigate: (page: "dashboard" | "assignments" | "announcements" | "metrics" | "parentGarden" | "forum") => void; // 添加forum
  badgeCounts?: {
    assignments?: number;
    announcements?: number;
  };
  onClearBadge?: (type: 'assignments' | 'announcements') => void;
}


export const AppSidebar = ({ user, currentPage, onNavigate, badgeCounts, onClearBadge }: AppSidebarProps) => {
  const { state } = useSidebar();
  const { signOut } = useAuth();
  const isCollapsed = state === "collapsed";

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
      badge: user.role === "parent" && badgeCounts && badgeCounts.assignments > 0 ? badgeCounts.assignments : null,
    },
    {
      title: "Announcements",
      page: "announcements" as const, 
      icon: Bell,
      badge: user.role === "parent" && badgeCounts && badgeCounts.announcements > 0 ? badgeCounts.announcements : null,
    },
    // + NEW: Metrics (visible to parents & teachers)
    {
      title: "Metrics",
      page: "metrics" as const,
      icon: TrendingUp,
      badge: null,
    },
    // Parent Garden (parent only)
    ...(user.role === "parent" ? [{
      title: "My Garden",
      page: "parentGarden" as const,
      icon: Sprout,
      badge: null,
    }] : []),
    // 添加Forum选项
    {
      title: "Forum",
      page: "forum" as const,
      icon: MessageSquare,
      badge: null,
    },
  ];

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

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
                KindyReach
              </h1>
              <p className="text-xs text-muted-foreground">Learning Platform</p>
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
                    onClick={() => {
                      // Clear badge when navigating to a page with notifications
                      if (onClearBadge && item.badge) {
                        if (item.page === 'assignments') {
                          onClearBadge('assignments');
                        } else if (item.page === 'announcements') {
                          onClearBadge('announcements');
                        }
                      }
                      onNavigate(item.page);
                    }}
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
                <p className="text-sm font-medium text-foreground truncate">{user.displayName}</p>
                <div className="flex items-center space-x-1">
                  <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
                  <Star className="h-3 w-3 text-warning" />
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
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
              onClick={handleLogout}
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
  user: UserType;
}

export const TopBar = ({ user }: TopBarProps) => {
  return (
    <header className="h-12 flex items-center border-b border-border bg-card px-4">
      <SidebarTrigger className="mr-4" />
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-foreground">
          {user.role === "parent" ? "Parent Portal" : 
           user.role === "teacher" ? "Teacher Dashboard" : 
           "Admin Dashboard"}
        </h2>
      </div>
    </header>
  );
};