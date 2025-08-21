import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Calendar, Clock, Plus, Pin, Users, Eye, AlertCircle, Star, PartyPopper } from "lucide-react";

interface AnnouncementPageProps {
  userRole: "parent" | "teacher";
}

export const AnnouncementPage = ({ userRole }: AnnouncementPageProps) => {
  const [filterType, setFilterType] = useState("all");
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    type: "general",
    priority: "normal"
  });

  // Demo announcements data
  const announcements = [
    {
      id: 1,
      title: "Holiday Party - December 22nd! 🎉",
      content: "Join us for our festive holiday celebration! We'll have cookie decorating, holiday songs, and a special visit from a surprise guest. Please bring a healthy snack to share if possible.",
      type: "event",
      priority: "high",
      author: "Ms. Anderson",
      createdAt: "2024-12-20T10:00:00Z",
      isPinned: true,
      readBy: userRole === "teacher" ? 22 : undefined,
      totalParents: userRole === "teacher" ? 24 : undefined,
      isRead: userRole === "parent" ? true : undefined
    },
    {
      id: 2,
      title: "Picture Day Reminder 📸",
      content: "Don't forget! Picture Day is this Friday, December 23rd. Please dress your little ones in their favorite outfit. Retakes will be available in January for any missed photos.",
      type: "reminder",
      priority: "normal",
      author: "Ms. Anderson",
      createdAt: "2024-12-19T14:30:00Z",
      isPinned: false,
      readBy: userRole === "teacher" ? 20 : undefined,
      totalParents: userRole === "teacher" ? 24 : undefined,
      isRead: userRole === "parent" ? true : undefined
    },
    {
      id: 3,
      title: "Show and Tell - Week of January 8th ⭐",
      content: "Next week's theme is 'My Favorite Book'. Children can bring their favorite book to share with the class. We'll practice speaking skills and learn about different stories together!",
      type: "activity",
      priority: "normal",
      author: "Ms. Anderson",
      createdAt: "2024-12-18T09:15:00Z",
      isPinned: false,
      readBy: userRole === "teacher" ? 18 : undefined,
      totalParents: userRole === "teacher" ? 24 : undefined,
      isRead: userRole === "parent" ? false : undefined
    },
    {
      id: 4,
      title: "Winter Weather Policy ❄️",
      content: "As winter weather approaches, please remember our snow day policy. Check your email and our school website for closure announcements. Dress children warmly for outdoor play!",
      type: "policy",
      priority: "high",
      author: "Principal Johnson",
      createdAt: "2024-12-17T16:45:00Z",
      isPinned: true,
      readBy: userRole === "teacher" ? 24 : undefined,
      totalParents: userRole === "teacher" ? 24 : undefined,
      isRead: userRole === "parent" ? true : undefined
    },
    {
      id: 5,
      title: "Parent-Teacher Conference Sign-ups Open",
      content: "Spring parent-teacher conferences will be held March 15-17. Sign-up sheets are available in the main office or contact me directly to schedule your preferred time slot.",
      type: "general",
      priority: "normal",
      author: "Ms. Anderson",
      createdAt: "2024-12-16T11:20:00Z",
      isPinned: false,
      readBy: userRole === "teacher" ? 15 : undefined,
      totalParents: userRole === "teacher" ? 24 : undefined,
      isRead: userRole === "parent" ? false : undefined
    }
  ];

  const filteredAnnouncements = announcements.filter(announcement => {
    if (filterType === "all") return true;
    return announcement.type === filterType;
  });

  const handleCreateAnnouncement = () => {
    console.log("Creating announcement:", newAnnouncement);
    setNewAnnouncement({ title: "", content: "", type: "general", priority: "normal" });
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "event": return <PartyPopper className="h-4 w-4" />;
      case "reminder": return <AlertCircle className="h-4 w-4" />;
      case "activity": return <Star className="h-4 w-4" />;
      case "policy": return <Bell className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "event": return "primary";
      case "reminder": return "warning";
      case "activity": return "accent";
      case "policy": return "destructive";
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return "Yesterday";
    return date.toLocaleDateString();
  };

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

        <div className="flex items-center space-x-3">
          {/* Filter */}
          <Select value={filterType} onValueChange={setFilterType}>
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
                    {announcements.filter(a => a.isPinned).length}
                  </p>
                  <p className="text-sm text-muted-foreground">Pinned</p>
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
            className={`hover:shadow-lg transition-shadow ${
              announcement.isPinned ? "border-l-4 border-l-warning" : ""
            } ${
              userRole === "parent" && !announcement.isRead ? "border-l-4 border-l-primary" : ""
            }`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    {announcement.isPinned && <Pin className="h-4 w-4 text-warning" />}
                    <CardTitle className="text-lg">{announcement.title}</CardTitle>
                    {userRole === "parent" && !announcement.isRead && (
                      <Badge variant="primary" className="text-xs">New</Badge>
                    )}
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
                      <span>{formatDate(announcement.createdAt)}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      by {announcement.author}
                    </div>
                  </div>
                </div>

                {userRole === "teacher" && (
                  <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{announcement.readBy}/{announcement.totalParents} read</span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-foreground whitespace-pre-wrap">{announcement.content}</p>
              
              {userRole === "teacher" && (
                <div className="mt-4 bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Read Status</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round((announcement.readBy! / announcement.totalParents!) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${(announcement.readBy! / announcement.totalParents!) * 100}%` }}
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
          </CardContent>
        </Card>
      )}
    </div>
  );
};