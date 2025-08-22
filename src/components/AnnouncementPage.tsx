import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Bell, Calendar, Clock, Plus, Pin, Users, Eye, AlertCircle, Star, PartyPopper, MessageCircle, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { AnnouncementService } from "@/lib/services/announcements";
import { Announcement, AnnouncementWithComments, Comment } from "@/lib/types";
import { CommentSection } from "./CommentSection";
import { FileViewer } from "./FileViewer";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AnnouncementPageProps {
  userRole: "parent" | "teacher" | "admin";
}

export const AnnouncementPage = ({ userRole }: AnnouncementPageProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filterType, setFilterType] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [announcements, setAnnouncements] = useState<AnnouncementWithComments[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementWithComments | null>(null);
  const [showComments, setShowComments] = useState<string | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    type: "general",
    priority: "normal"
  });

  // Load announcements based on user role
  useEffect(() => {
    const loadAnnouncements = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        let announcementsData: AnnouncementWithComments[] = [];
        
        if (user.role === 'teacher') {
          // For teachers, get announcements from their classes
          try {
            // Get teacher's classes first
            const classesQuery = query(
              collection(db, 'classes'),
              where('teacherId', '==', user.uid),
              where('isActive', '==', true)
            );
            const classesSnapshot = await getDocs(classesQuery);
            
            // Get announcements from all teacher's classes
            for (const classDoc of classesSnapshot.docs) {
              const classAnnouncements = await AnnouncementService.getClassAnnouncementsWithComments(classDoc.id);
              announcementsData.push(...classAnnouncements);
            }
          } catch (error) {
            console.error('Error loading teacher announcements:', error);
          }
        } else if (user.role === 'parent') {
          // For parents, get announcements from their child's class
          try {
            // Get parent's student(s) first
            const studentsQuery = query(
              collection(db, 'students'),
              where('parentId', '==', user.uid),
              where('isActive', '==', true)
            );
            const studentsSnapshot = await getDocs(studentsQuery);
            
            // Get announcements from student's class
            for (const studentDoc of studentsSnapshot.docs) {
              const studentData = studentDoc.data();
              if (studentData.classId) {
                const classAnnouncements = await AnnouncementService.getClassAnnouncementsWithComments(studentData.classId);
                announcementsData.push(...classAnnouncements);
              }
            }
          } catch (error) {
            console.error('Error loading parent announcements:', error);
          }
        } else if (user.role === 'admin') {
          // For admins, get all announcements
          try {
            // Get all classes first
            const classesQuery = query(collection(db, 'classes'), where('isActive', '==', true));
            const classesSnapshot = await getDocs(classesQuery);
            
            // Get announcements from all classes
            for (const classDoc of classesSnapshot.docs) {
              const classAnnouncements = await AnnouncementService.getClassAnnouncementsWithComments(classDoc.id);
              announcementsData.push(...classAnnouncements);
            }
          } catch (error) {
            console.error('Error loading admin announcements:', error);
          }
        }
        
        setAnnouncements(announcementsData);
      } catch (error) {
        console.error('Error loading announcements:', error);
        toast({
          title: "Error",
          description: "Failed to load announcements. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadAnnouncements();
  }, [user, toast]);

  const filteredAnnouncements = announcements.filter(announcement => {
    const matchesType = filterType === "all" || announcement.type === filterType;
    const matchesSearch = announcement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         announcement.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const handleCommentAdded = async (announcementId: string, comment: Comment) => {
    try {
      // Add comment to database
      await AnnouncementService.addComment(announcementId, {
        userId: comment.userId,
        userDisplayName: comment.userDisplayName,
        userRole: comment.userRole,
        content: comment.content
      });
      
      // Update local state
      setAnnouncements(prev => prev.map(announcement => {
        if (announcement.id === announcementId) {
          return {
            ...announcement,
            comments: [...(announcement.comments || []), comment],
            commentCount: (announcement.commentCount || 0) + 1
          };
        }
        return announcement;
      }));
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCommentUpdated = async (announcementId: string, commentId: string, updates: Partial<Comment>) => {
    try {
      // Update comment in database
      await AnnouncementService.updateComment(announcementId, commentId, updates);
      
      // Update local state
      setAnnouncements(prev => prev.map(announcement => {
        if (announcement.id === announcementId) {
          return {
            ...announcement,
            comments: announcement.comments?.map(comment => 
              comment.id === commentId ? { ...comment, ...updates } : comment
            ) || []
          };
        }
        return announcement;
      }));
    } catch (error) {
      console.error('Error updating comment:', error);
      toast({
        title: "Error",
        description: "Failed to update comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCommentDeleted = async (announcementId: string, commentId: string) => {
    try {
      // Delete comment from database
      await AnnouncementService.deleteComment(announcementId, commentId);
      
      // Update local state
      setAnnouncements(prev => prev.map(announcement => {
        if (announcement.id === announcementId) {
          return {
            ...announcement,
            comments: announcement.comments?.filter(comment => comment.id !== commentId) || [],
            commentCount: Math.max(0, (announcement.commentCount || 0) - 1)
          };
        }
        return announcement;
      }));
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast({
        title: "Error",
        description: "Failed to delete comment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleCreateAnnouncement = async () => {
    try {
      // TODO: Implement announcement creation with Firebase
      console.log("Creating announcement:", newAnnouncement);
      setNewAnnouncement({ title: "", content: "", type: "general", priority: "normal" });
      toast({
        title: "Success",
        description: "Announcement created successfully!",
      });
    } catch (error) {
      console.error('Error creating announcement:', error);
      toast({
        title: "Error",
        description: "Failed to create announcement. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "event": return <PartyPopper className="h-4 w-4" />;
      case "reminder": return <AlertCircle className="h-4 w-4" />;
      case "activity": return <Star className="h-4 w-4" />;
      case "general": return <Bell className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "event": return "primary";
      case "reminder": return "warning";
      case "activity": return "accent";
      case "general": return "secondary";
      default: return "secondary";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "destructive";
      case "normal": return "secondary";
      default: return "secondary";
    }
  };

  const formatTimeAgo = (date: any) => {
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
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading announcements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Announcements</h1>
          <p className="text-muted-foreground mt-1">
            {userRole === "parent" 
              ? "Stay updated with class news and important information"
              : "Share updates and important information with parents"
            }
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Input
              className="pl-9"
              placeholder="Search announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>

          <Select value={filterType} onValueChange={(value) => setFilterType(value)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="event">Events</SelectItem>
              <SelectItem value="reminder">Reminders</SelectItem>
              <SelectItem value="activity">Activities</SelectItem>
              <SelectItem value="policy">Policy</SelectItem>
              <SelectItem value="general">General</SelectItem>
            </SelectContent>
          </Select>

          {/* Create Announcement (Teacher only) */}
          {userRole === "teacher" && (
            <Dialog>
              <DialogTrigger asChild>
                <Button className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>New Announcement</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New Announcement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="announcement-title">Title</Label>
                    <Input
                      id="announcement-title"
                      value={newAnnouncement.title}
                      onChange={(e) => setNewAnnouncement({...newAnnouncement, title: e.target.value})}
                      placeholder="e.g., Field Trip Next Friday"
                    />
                  </div>
                  <div>
                    <Label htmlFor="announcement-type">Type</Label>
                    <Select onValueChange={(value) => setNewAnnouncement({...newAnnouncement, type: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="event">Event</SelectItem>
                        <SelectItem value="reminder">Reminder</SelectItem>
                        <SelectItem value="activity">Activity</SelectItem>
                        <SelectItem value="policy">Policy</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="announcement-priority">Priority</Label>
                    <Select onValueChange={(value) => setNewAnnouncement({...newAnnouncement, priority: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="announcement-content">Message</Label>
                    <Textarea
                      id="announcement-content"
                      value={newAnnouncement.content}
                      onChange={(e) => setNewAnnouncement({...newAnnouncement, content: e.target.value})}
                      placeholder="Write your announcement here..."
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleCreateAnnouncement} className="w-full">
                    Send Announcement
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Announcement Stats (Teacher only) */}
      {userRole === "teacher" && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Bell className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{announcements.length}</p>
                  <p className="text-sm text-muted-foreground">Total Announcements</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Eye className="h-8 w-8 text-success" />
                <div>
                  <p className="text-2xl font-bold">92%</p>
                  <p className="text-sm text-muted-foreground">Average Read Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-warning">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Pin className="h-8 w-8 text-warning" />
                <div>
                  <p className="text-2xl font-bold">
                    {announcements.filter(a => a.priority === 'high').length}
                  </p>
                  <p className="text-sm text-muted-foreground">High Priority</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-accent">
            <CardContent className="p-4">
              <div className="flex items-center space-x-3">
                <Users className="h-8 w-8 text-accent" />
                <div>
                  <p className="text-2xl font-bold">24</p>
                  <p className="text-sm text-muted-foreground">Parent Recipients</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Announcements List */}
      <div className="space-y-4">
        {filteredAnnouncements.map((announcement) => (
          <Card 
            key={announcement.id} 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedAnnouncement(announcement)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <CardTitle className="text-lg">{announcement.title}</CardTitle>
                  </div>
                  <div className="flex items-center space-x-3 flex-wrap">
                    <Badge variant={getTypeColor(announcement.type)} className="flex items-center space-x-1">
                      {getTypeIcon(announcement.type)}
                      <span className="capitalize">{announcement.type}</span>
                    </Badge>
                    {announcement.priority === "high" && (
                      <Badge variant={getPriorityColor(announcement.priority)}>
                        High Priority
                      </Badge>
                    )}
                    <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeAgo(announcement.createdAt)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      by Teacher
                    </div>
                  </div>
                </div>

                {userRole === "teacher" && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{announcement.readBy?.length || 0} read</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap">{announcement.content}</p>
              
              {userRole === "teacher" && announcement.readBy && (
                <div className="mt-4 bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Read Status</span>
                    <span className="text-sm text-muted-foreground">
                      {announcement.readBy.length > 0 ? Math.round((announcement.readBy.length / 24) * 100) : 0}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${announcement.readBy.length > 0 ? Math.round((announcement.readBy.length / 24) * 100) : 0}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredAnnouncements.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No announcements found</h3>
            <p className="text-muted-foreground">
              {filterType === "all" 
                ? "No announcements have been posted yet."
                : `No ${filterType} announcements found.`
              }
            </p>
            {userRole === "teacher" && (
              <p className="text-sm text-muted-foreground mt-2">
                Create announcements from your Teacher Dashboard to get started.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Announcement Detail Dialog */}
      <Dialog open={!!selectedAnnouncement} onOpenChange={() => setSelectedAnnouncement(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          {selectedAnnouncement && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedAnnouncement.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2">Content</h4>
                  <p className="text-muted-foreground whitespace-pre-wrap">{selectedAnnouncement.content}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Type</h4>
                    <Badge variant={getTypeColor(selectedAnnouncement.type)} className="flex items-center space-x-1 w-fit">
                      {getTypeIcon(selectedAnnouncement.type)}
                      <span className="capitalize">{selectedAnnouncement.type}</span>
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Priority</h4>
                    <Badge variant={getPriorityColor(selectedAnnouncement.priority)} className="w-fit">
                      {selectedAnnouncement.priority === 'high' ? 'High Priority' : 'Normal'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Posted</h4>
                    <p className="text-muted-foreground">{formatTimeAgo(selectedAnnouncement.createdAt)}</p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Comments</h4>
                    <p className="text-muted-foreground">{selectedAnnouncement.commentCount || 0}</p>
                  </div>
                </div>

                {selectedAnnouncement.attachments && selectedAnnouncement.attachments.length > 0 && (
                  <div>
                    <h4 className="font-medium mb-2">Attachments</h4>
                    <FileViewer 
                      files={selectedAnnouncement.attachments}
                      title=""
                      showDownloadButton={true}
                      showPreviewButton={true}
                      compact={true}
                    />
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-2">Comments ({selectedAnnouncement.commentCount || 0})</h4>
                  <CommentSection
                    assignmentId={selectedAnnouncement.id}
                    comments={selectedAnnouncement.comments || []}
                    onCommentAdded={(comment) => handleCommentAdded(selectedAnnouncement.id, comment)}
                    onCommentUpdated={(commentId, updates) => handleCommentUpdated(selectedAnnouncement.id, commentId, updates)}
                    onCommentDeleted={(commentId) => handleCommentDeleted(selectedAnnouncement.id, commentId)}
                  />
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};