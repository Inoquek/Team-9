import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Upload, File, X, Bell, Video, Image, FileText } from 'lucide-react';
import { AnnouncementService } from '@/lib/services/announcements';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/contexts/AuthContext';

interface AnnouncementCreationProps {
  classId: string;
  className: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const AnnouncementCreation: React.FC<AnnouncementCreationProps> = ({ 
  classId, 
  className, 
  onSuccess, 
  onCancel 
}) => {
  const { user } = useAuth();
  const [announcement, setAnnouncement] = useState({
    title: '',
    content: '',
    type: 'general',
    priority: 'normal'
  });
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!announcement.title.trim() || !announcement.content.trim() || !user?.uid) {
      toast({
        title: "Missing Information",
        description: "Please fill in title and content.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      // Upload files first if any
      let attachments = [];
      if (selectedFiles.length > 0) {
        try {
          const basePath = `announcements/${classId}/${user.uid}/${Date.now()}`;
          const uploadedUrls = await StorageService.uploadMultipleFiles(selectedFiles, basePath);
          
          attachments = selectedFiles.map((file, index) => ({
            id: `${Date.now()}_${index}`,
            name: file.name,
            url: uploadedUrls[index],
            type: file.type,
            size: file.size,
            uploadedAt: new Date()
          }));
        } catch (uploadError) {
          console.error('File upload failed:', uploadError);
          toast({
            title: "File Upload Failed",
            description: "Some files failed to upload. Please try again.",
            variant: "destructive"
          });
          return;
        }
      }

      // Create announcement in database
      const announcementData = {
        title: announcement.title.trim(),
        content: announcement.content.trim(),
        type: announcement.type as 'general' | 'event' | 'reminder' | 'activity',
        priority: announcement.priority as 'low' | 'normal' | 'high',
        teacherId: user.uid,
        classId: classId,
        attachments: attachments
      };

      await AnnouncementService.createAnnouncement(announcementData);

      toast({
        title: "Announcement Created!",
        description: `${announcement.title} has been sent successfully.`,
      });

      onSuccess();
    } catch (error: any) {
      toast({
        title: "Creation Failed",
        description: error.message || "Something went wrong.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('video/')) return <Video className="h-5 w-5 text-red-500" />;
    if (file.type.startsWith('image/')) return <Image className="h-5 w-5 text-green-500" />;
    if (file.type.includes('pdf') || file.type.includes('document')) return <FileText className="h-5 w-5 text-blue-500" />;
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'normal': return 'bg-blue-100 text-blue-800';
      case 'low': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Create New Announcement</h2>
          <p className="text-muted-foreground">For {className}</p>
        </div>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bell className="h-5 w-5" />
              <span>Announcement Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={announcement.title}
                  onChange={(e) => setAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Field Trip Next Friday"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={announcement.type}
                  onValueChange={(value) => setAnnouncement(prev => ({ ...prev, type: value as 'general' | 'event' | 'reminder' | 'activity' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general" textValue="General">General</SelectItem>
                    <SelectItem value="event" textValue="Event">Event</SelectItem>
                    <SelectItem value="reminder" textValue="Reminder">Reminder</SelectItem>
                    <SelectItem value="activity" textValue="Activity">Activity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select
                  value={announcement.priority}
                  onValueChange={(value) => setAnnouncement(prev => ({ ...prev, priority: value as 'low' | 'normal' | 'high' }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low" textValue="Low Priority">Low Priority</SelectItem>
                    <SelectItem value="normal" textValue="Normal Priority">Normal Priority</SelectItem>
                    <SelectItem value="high" textValue="High Priority">High Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Message *</Label>
              <Textarea
                id="content"
                value={announcement.content}
                onChange={(e) => setAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your announcement here..."
                rows={4}
                required
              />
            </div>

            {/* Priority Badge */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">Priority:</span>
              <Badge className={getPriorityColor(announcement.priority)}>
                {announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1)} Priority
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Attachments</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Upload Files or Videos</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  Support for documents, images, and videos
                </p>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                >
                  Choose Files
                </Button>
                <input
                  id="file-upload"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileSelect}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi,.webm"
                  aria-label="Upload announcement files"
                />
              </div>
            </div>

            {/* Selected Files */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <Label>Selected Files ({selectedFiles.length})</Label>
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center space-x-3">
                        {getFileIcon(file)}
                        <div>
                          <p className="font-medium text-sm">{file.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(file.size)} • {file.type || 'Unknown type'}
                          </p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Supported formats: PDF, Word, PowerPoint, Images (JPG, PNG, GIF), Videos (MP4, MOV, AVI, WebM)
            </p>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">{announcement.title || 'Announcement Title'}</h3>
                <Badge className={getPriorityColor(announcement.priority)}>
                  {announcement.priority.charAt(0).toUpperCase() + announcement.priority.slice(1)}
                </Badge>
              </div>
              <p className="text-sm">
                {announcement.content || 'Your announcement content will appear here...'}
              </p>
              {selectedFiles.length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-muted-foreground mb-2">Attachments ({selectedFiles.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedFiles.map((file, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {file.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating}>
            {isCreating ? "Creating..." : "Send Announcement"}
          </Button>
        </div>
      </form>
    </div>
  );
};
