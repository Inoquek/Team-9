import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FileUpload } from "./FileUpload";
import { useToast } from "@/hooks/use-toast";
import { SubmissionService } from "@/lib/services/assignments";
import { Assignment } from "@/lib/types";
import { BookOpen, Calendar, Target, Upload } from "lucide-react";

interface HomeworkSubmissionProps {
  assignment: Assignment;
  studentId: string;
  parentId: string;
  onSubmitSuccess: () => void;
  className?: string;
}

export const HomeworkSubmission = ({
  assignment,
  studentId,
  parentId,
  onSubmitSuccess,
  className
}: HomeworkSubmissionProps) => {
  const [notes, setNotes] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; type: string; filename: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleFilesUploaded = (files: Array<{ url: string; type: string; filename: string }>) => {
    setUploadedFiles(files);
  };

  const handleSubmit = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "No Files Selected",
        description: "Please upload at least one file for your homework submission.",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      const submission = {
        assignmentId: assignment.id,
        studentId,
        parentId,
        files: uploadedFiles.map(file => ({
          id: Date.now().toString(),
          type: file.type.startsWith('image/') ? 'image' : 
                file.type.startsWith('video/') ? 'video' : 'audio',
          url: file.url,
          filename: file.filename,
          size: 0, // This would need to be calculated from the original file
          uploadedAt: new Date()
        }))
      };

      await SubmissionService.submitHomework(submission);

      toast({
        title: "Homework Submitted!",
        description: "Your submission has been sent to the teacher for review.",
      });

      // Reset form
      setNotes("");
      setUploadedFiles([]);
      onSubmitSuccess();
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Failed",
        description: "There was an error submitting your homework. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, string> = {
      alphabet: '🔤',
      vocabulary: '📚',
      sightWords: '👁️',
      reading: '📖',
      writing: '✏️'
    };
    return icons[category] || '📝';
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <span>Submit Homework</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Assignment Info */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-2">
            <span className="text-2xl">{getCategoryIcon(assignment.category)}</span>
            <div>
              <h3 className="font-semibold text-foreground">{assignment.title}</h3>
              <p className="text-sm text-muted-foreground">{assignment.description}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="flex items-center space-x-1">
              <Target className="h-3 w-3" />
              <span className="capitalize">{assignment.category}</span>
            </Badge>
            <Badge variant="secondary" className="flex items-center space-x-1">
              <Calendar className="h-3 w-3" />
              <span>Due: {assignment.dueDate.toLocaleDateString()}</span>
            </Badge>
          </div>
        </div>

        {/* File Upload */}
        <FileUpload
          onFilesUploaded={handleFilesUploaded}
          maxFiles={5}
          acceptedTypes={['image/*', 'video/*', 'audio/*']}
        />

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Additional Notes (Optional)</Label>
          <Textarea
            id="notes"
            placeholder="Add any notes or comments about the homework..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || uploadedFiles.length === 0}
          className="w-full"
          size="lg"
        >
          <Upload className="h-4 w-4 mr-2" />
          {submitting ? "Submitting..." : "Submit Homework"}
        </Button>

        {/* Submission Guidelines */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p><strong>Submission Guidelines:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Upload clear photos, videos, or audio recordings</li>
            <li>Maximum 5 files per submission</li>
            <li>Supported formats: JPG, PNG, MP4, MOV, MP3, WAV</li>
            <li>Your teacher will review and provide feedback</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
