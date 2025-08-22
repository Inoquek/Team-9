import { useState } from "react";
import { LoginPage } from "@/components/LoginPage";
import { ParentDashboard } from "@/components/ParentDashboard";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AssignmentPage } from "@/components/AssignmentPage";
import { AnnouncementPage } from "@/components/AnnouncementPage";
import { ForumPage } from "@/components/ForumPage"; // 添加Forum导入
import { AppSidebar, TopBar } from "@/components/Navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";

type CurrentPage = "dashboard" | "assignments" | "announcements" | "forum"; // 添加forum

const Index = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<CurrentPage>("dashboard");

  const handleNavigate = (page: CurrentPage) => {
    setCurrentPage(page);
  };

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Show login page if user is not authenticated
  if (!user) {
    return <LoginPage />;
  }

  // Main application layout with sidebar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar 
          user={user}
          currentPage={currentPage}
          onNavigate={handleNavigate}
        />
        
        <div className="flex-1 flex flex-col">
          <TopBar user={user} />
          
          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto">
              {currentPage === "dashboard" && (
                user.role === "parent" ? (
                  <ParentDashboard onNavigate={handleNavigate} />
                ) : user.role === "teacher" ? (
                  <TeacherDashboard onNavigate={handleNavigate} />
                ) : (
                  <AdminDashboard onNavigate={handleNavigate} />
                )
              )}
              
              {currentPage === "assignments" && (
                <AssignmentPage userRole={user.role} />
              )}
              
              {currentPage === "announcements" && (
                <AnnouncementPage userRole={user.role} />
              )}
              
              {/* 添加Forum页面 */}
              {currentPage === "forum" && (
                <ForumPage 
                  userRole={user.role} 
                  currentUserName={user.displayName}
                />
              )}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;