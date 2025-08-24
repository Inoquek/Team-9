import { useState, useCallback, useEffect } from "react";
import { LoginPage } from "@/components/LoginPage";
import { ParentDashboard } from "@/components/ParentDashboard";
import { TeacherDashboard } from "@/components/TeacherDashboard";
import { AdminDashboard } from "@/components/AdminDashboard";
import { AssignmentPage } from "@/components/AssignmentPage";
import { AnnouncementPage } from "@/components/AnnouncementPage";

import { ParentGarden } from "@/components/ParentGarden";
import { ForumPage } from "@/components/ForumPage"; // 添加Forum导入
import { AppSidebar, TopBar } from "@/components/Navigation";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { TeacherClassProvider } from "@/contexts/TeacherClassContext";
import { Metrics } from "@/components/Metrics";

type CurrentPage = "dashboard" | "assignments" | "announcements" | "metrics" | "parentGarden" | "forum"; // 添加forum

const Index = () => {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<CurrentPage>("dashboard");
  const [badgeCounts, setBadgeCounts] = useState({ assignments: 0, announcements: 0 });

  // Load badge counts from localStorage on component mount
  useEffect(() => {
    const savedBadgeCounts = localStorage.getItem('badgeCounts');
    if (savedBadgeCounts) {
      try {
        const parsed = JSON.parse(savedBadgeCounts);
        setBadgeCounts(parsed);
      } catch (error) {
        console.error('Error parsing saved badge counts:', error);
      }
    }
  }, []);



  const handleClearBadge = useCallback((type: 'assignments' | 'announcements') => {
    setBadgeCounts(prev => {
      const newCounts = {
        ...prev,
        [type]: 0
      };
      // Save to localStorage
      localStorage.setItem('badgeCounts', JSON.stringify(newCounts));
      return newCounts;
    });
  }, []);

  const handleNavigate = useCallback((page: CurrentPage) => {
    // Clear badges when navigating to pages with notifications
    if (page === 'assignments' && badgeCounts.assignments > 0) {
      handleClearBadge('assignments');
    } else if (page === 'announcements' && badgeCounts.announcements > 0) {
      handleClearBadge('announcements');
    }
    
    setCurrentPage(page);
  }, [badgeCounts, handleClearBadge]);

  const handleBadgeCountsUpdate = useCallback((counts: { assignments: number; announcements: number }) => {
    setBadgeCounts(counts);
    // Save to localStorage
    localStorage.setItem('badgeCounts', JSON.stringify(counts));
  }, []);

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
      <TeacherClassProvider>
        <div className="min-h-screen flex w-full bg-background">
          <AppSidebar 
            user={user}
            currentPage={currentPage}
            onNavigate={handleNavigate}
            badgeCounts={badgeCounts}
            onClearBadge={handleClearBadge}
          />
          
          <div className="flex-1 flex flex-col">
            <TopBar user={user} />
            
            <main className="flex-1 p-6 overflow-auto">
              <div className="max-w-7xl mx-auto">
                {currentPage === "dashboard" && (
                  <>
                    {user.role === "parent" ? (
                      <ParentDashboard 
                        onNavigate={handleNavigate} 
                        onBadgeCountsUpdate={handleBadgeCountsUpdate}
                      />
                    ) : user.role === "teacher" ? (
                      <TeacherDashboard onNavigate={handleNavigate} />
                    ) : (
                      <AdminDashboard onNavigate={handleNavigate} />
                    )}
                  </>
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

                {currentPage === "metrics" && <Metrics />}



                {currentPage === "parentGarden" && <ParentGarden />}
            </div>
            </main>
          </div>
        </div>
      </TeacherClassProvider>
    </SidebarProvider>
  );
};

export default Index;