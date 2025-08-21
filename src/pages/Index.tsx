import { useState } from "react";
import { LoginPage } from "@/components/LoginPage";
import { ParentDashboard } from "@/components/ParentDashboard";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { AssignmentPage } from "@/components/AssignmentPage";
import { AnnouncementPage } from "@/components/AnnouncementPage";
import { Navigation } from "@/components/Navigation";

type UserRole = "parent" | "teacher" | null;
type CurrentPage = "dashboard" | "assignments" | "announcements";

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

  // Main application layout
  return (
    <div className="min-h-screen bg-background">
      <Navigation 
        userRole={userRole}
        currentPage={currentPage}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      </main>
    </div>
  );
};

export default Index;
