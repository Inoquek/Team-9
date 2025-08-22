import { useState } from "react";
import { LoginPage } from "@/components/LoginPage";
import { ParentDashboard } from "@/components/ParentDashboard";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { AssignmentPage } from "@/components/AssignmentPage";
import { AnnouncementPage } from "@/components/AnnouncementPage";
import { MetricsPage } from "@/components/MetricsPage"; 
import { AppSidebar, TopBar } from "@/components/Navigation";
import { SidebarProvider } from "@/components/ui/sidebar";

type UserRole = "parent" | "teacher" | null;
type CurrentPage = "dashboard" | "assignments" | "announcements" | "metrics";

const Index = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [currentPage, setCurrentPage] = useState<CurrentPage>("dashboard");

  const handleLogin = (role: "parent" | "teacher") => {
    setUserRole(role);
    setCurrentPage("dashboard");
  };

  const handleLogout = () => {
    setUserRole(null);
    setCurrentPage("dashboard");
  };

  const handleNavigate = (page: CurrentPage) => {
    setCurrentPage(page);
  };

  // Show login page if user is not authenticated
  if (!userRole) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Main application layout with sidebar
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar 
          userRole={userRole}
          currentPage={currentPage}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
        
        <div className="flex-1 flex flex-col">
          <TopBar userRole={userRole} />
          
          <main className="flex-1 p-6 overflow-auto">
            <div className="max-w-7xl mx-auto">
              {currentPage === "dashboard" && (
                userRole === "parent" ? (
                  <ParentDashboard onNavigate={handleNavigate} />
                ) : (
                  <TeacherDashboard onNavigate={handleNavigate} />
                )
              )}
              
              {currentPage === "assignments" && (
                <AssignmentPage userRole={userRole} />
              )}
              
              {currentPage === "announcements" && (
                <AnnouncementPage userRole={userRole} />
              )}
              {currentPage === "metrics" && (
                <MetricsPage userRole={userRole} />
              )}
              
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
