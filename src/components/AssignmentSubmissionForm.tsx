import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { X, Upload, File, Clock, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Assignment, SubmissionFile } from '@/lib/types';
import { StorageService } from '@/lib/services/storage';
import { SubmissionService } from '@/lib/services/assignments';
import { StudyTimeService } from '@/lib/services/studyTime';

interface AssignmentSubmissionFormProps {
  assignment: Assignment;
  studentId: string;
  parentId: string;
  completionTimeMinutes: number;
  onSubmissionComplete: (submissionId: string) => void;
  onCancel: () => void;
}

interface FileUpload {
  id: string;
  name: string;
  type: string;
  size: number;
  file: File;
  uploadProgress: number;
  isUploading: boolean;
}

export const AssignmentSubmissionForm: React.FC<AssignmentSubmissionFormProps> = ({
  assignment,
  studentId,
  parentId,
  completionTimeMinutes,
  onSubmissionComplete,
  onCancel
}) => {
  const { toast } = useToast();
  const [uploadedFiles, setUploadedFiles] = useState<FileUpload[]>([]);
  const [submissionNote, setSubmissionNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: FileUpload[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Check file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds the 5MB size limit.`,
          variant: "destructive"
        });
        continue;
      }

      // Check total files limit
      if (uploadedFiles.length + newFiles.length >= 5) {
        toast({
          title: "Too many files",
          description: "You can upload a maximum of 5 files.",
          variant: "destructive"
        });
        break;
      }

      const fileUpload: FileUpload = {
        id: crypto.randomUUID(),
        name: file.name,
        type: file.type,
        size: file.size,
        file,
        uploadProgress: 0,
        isUploading: false
      };

      newFiles.push(fileUpload);
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    if (newFiles.length > 0) {
      toast({
        title: "Files added",
        description: `${newFiles.length} file(s) added to upload queue.`,
      });
    }

    // Clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const uploadFile = async (fileUpload: FileUpload): Promise<SubmissionFile> => {
    try {
      // Update progress
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileUpload.id 
          ? { ...f, isUploading: true, uploadProgress: 0 }
          : f
      ));

      // Upload to Firebase Storage
      const uploadPath = `submissions/${assignment.id}/${studentId}/${Date.now()}_${fileUpload.name}`;
      const downloadUrl = await StorageService.uploadFile(
        fileUpload.file, 
        uploadPath,
        (progress) => {
          setUploadedFiles(prev => prev.map(f => 
            f.id === fileUpload.id 
              ? { ...f, uploadProgress: progress }
              : f
          ));
        }
      );

      // Create submission file object
      const submissionFile: SubmissionFile = {
        id: crypto.randomUUID(),
        type: fileUpload.type.startsWith('image/') ? 'image' : 
              fileUpload.type.startsWith('video/') ? 'video' : 'audio',
        url: downloadUrl,
        filename: fileUpload.name,
        size: fileUpload.size,
        uploadedAt: new Date()
      };

      // Mark as complete
      setUploadedFiles(prev => prev.map(f => 
        f.id === fileUpload.id 
          ? { ...f, isUploading: false, uploadProgress: 100 }
          : f
      ));

      return submissionFile;
    } catch (error) {
      console.error(`Error uploading file ${fileUpload.name}:`, error);
      throw new Error(`Failed to upload ${fileUpload.name}`);
    }
  };

  const handleSubmit = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No files",
        description: "Please upload at least one file before submitting.",
        variant: "destructive"
      });
      return;
    }

    if (completionTimeMinutes === 0) {
      toast({
        title: "No completion time",
        description: "Please track your study time before submitting.",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      setOverallProgress(0);

      // Upload all files
      const submissionFiles: SubmissionFile[] = [];
      const totalFiles = uploadedFiles.length;
      
      for (let i = 0; i < uploadedFiles.length; i++) {
        const fileUpload = uploadedFiles[i];
        const submissionFile = await uploadFile(fileUpload);
        submissionFiles.push(submissionFile);
        
        // Update overall progress
        const progress = ((i + 1) / totalFiles) * 100;
        setOverallProgress(progress);
      }

      // Get today's study time
      const today = new Date().toISOString().split('T')[0];
      const todayStudyTime = await StudyTimeService.getTodayStudyTime(studentId);
      const studyTimeToday = todayStudyTime?.totalMinutes || 0;

      // Create submission object
      const submissionData = {
        assignmentId: assignment.id,
        studentId,
        parentId,
        files: submissionFiles,
        completionTimeMinutes,
        studyTimeToday
      };

      // Save submission to Firestore
      const submissionId = await SubmissionService.submitHomework(submissionData);

      // Update study time
      await StudyTimeService.addStudyTime(studentId, today, completionTimeMinutes);

      toast({
        title: "🎉 Assignment submitted successfully!",
        description: `Your work has been uploaded and submitted. Time spent: ${completionTimeMinutes} minutes.`,
      });

      onSubmissionComplete(submissionId);
    } catch (error) {
      console.error('Error submitting assignment:', error);
      toast({
        title: "Submission failed",
        description: error instanceof Error ? error.message : "Failed to submit assignment. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
      setOverallProgress(0);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    return '📄';
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          Submit Assignment
          <Badge variant="secondary" className="ml-auto">
            {assignment.title}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assignment Info */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Assignment Details</Label>
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm">
              <div className="font-medium">{assignment.title}</div>
              <div className="text-muted-foreground">{assignment.description}</div>
              <div className="flex items-center gap-4 mt-2 text-xs">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {completionTimeMinutes} min completed
                </span>
                <span className="flex items-center gap-1">
                  <File className="h-3 w-3" />
                  {assignment.type}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Upload Files</Label>
          <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
            <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-2">
              Drag and drop files here, or click to browse
            </p>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
            >
              Choose Files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Maximum 5 files, 5MB each. Supported: Images, Videos, Audio, PDF, Word docs
            </p>
          </div>
        </div>

        {/* File List */}
        {uploadedFiles.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Files to Upload</Label>
            <div className="space-y-2">
              {uploadedFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <span className="text-lg">{getFileIcon(file.type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </div>
                    {file.isUploading && (
                      <Progress value={file.uploadProgress} className="h-1 mt-1" />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(file.id)}
                    disabled={file.isUploading}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Overall Progress */}
        {isSubmitting && overallProgress > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Upload Progress</Label>
            <Progress value={overallProgress} className="h-2" />
            <div className="text-xs text-muted-foreground text-center">
              {Math.round(overallProgress)}% complete
            </div>
          </div>
        )}

        {/* Submission Note */}
        <div className="space-y-2">
          <Label htmlFor="note" className="text-sm font-medium">
            Additional Notes (Optional)
          </Label>
          <Textarea
            id="note"
            placeholder="Add any comments or notes about your submission..."
            value={submissionNote}
            onChange={(e) => setSubmissionNote(e.target.value)}
            disabled={isSubmitting}
            rows={3}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || uploadedFiles.length === 0 || completionTimeMinutes === 0}
            className="min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Submitting...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Submit Assignment
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
