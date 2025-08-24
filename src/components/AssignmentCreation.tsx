import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Upload, File, X, Calendar, BookOpen, Users, Star, CheckCircle } from 'lucide-react';
import { AssignmentService, SubmissionService } from '@/lib/services/assignments';
import { StorageService } from '@/lib/services/storage';
import { useAuth } from '@/contexts/AuthContext';


interface AssignmentCreationProps {
  classId: string;
  className: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface AssignmentType {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

const ASSIGNMENT_TYPES: AssignmentType[] = [
  {
    id: 'alphabet-time',
    name: 'Alphabet Time',
    description: 'Letter recognition and phonics activities',
    icon: '🔤',
    color: 'bg-blue-100 text-blue-800'
  },
  {
    id: 'vocabulary-time',
    name: 'Vocabulary Time',
    description: 'Word learning and language development',
    icon: '📚',
    color: 'bg-green-100 text-green-800'
  },
  {
    id: 'sight-words-time',
    name: 'Sight Words Time',
    description: 'Common word recognition practice',
    icon: '👁️',
    color: 'bg-purple-100 text-purple-800'
  },
  {
    id: 'reading-time',
    name: 'Reading Time',
    description: 'Reading comprehension and fluency',
    icon: '📖',
    color: 'bg-orange-100 text-orange-800'
  },
  {
    id: 'post-programme-test',
    name: 'Post Programme Test',
    description: 'Assessment and evaluation activities',
    icon: '✅',
    color: 'bg-red-100 text-red-800'
  }
];

export const AssignmentCreation: React.FC<AssignmentCreationProps> = ({ 
  classId, 
  className, 
  onSuccess, 
  onCancel 
}) => {
  const { user } = useAuth();
  const [assignment, setAssignment] = useState({
    title: '',
    description: '',
    type: '',
    dueDate: '',
    instructions: '',
    points: 10,
    estimatedTime: 15
  });
  
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isInClassGraded, setIsInClassGraded] = useState(false);

  const { toast } = useToast();

  const handleInClassGradedChange = (checked: boolean) => {
    setIsInClassGraded(checked);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assignment.title.trim() || !assignment.type || !assignment.dueDate || !user?.uid) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
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
          const basePath = `assignments/${classId}/${user.uid}/${Date.now()}`;
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

      // Create assignment in database
      const assignmentData = {
        title: assignment.title.trim(),
        description: assignment.description.trim(),
        category: assignment.type, // Use type as category
        type: assignment.type as any,
        dueDate: new Date(assignment.dueDate),
        teacherId: user.uid,
        classId: classId,
        instructions: assignment.instructions.trim(),
        points: assignment.points,
        estimatedTime: assignment.estimatedTime,
        attachments: attachments,
        status: 'active' as const
      };

      const assignmentId = await AssignmentService.createAssignment(assignmentData);

      toast({
        title: "Assignment Created!",
        description: `${assignment.title} has been created successfully.`,
      });

      // If this is an in-class graded assignment, create placeholder submissions
      if (isInClassGraded) {
        try {
          console.log('Creating placeholder submissions for in-class assignment...');
          await SubmissionService.createPlaceholderSubmissions({
            assignmentId,
            classId,
            teacherId: user.uid
          });
          console.log('Placeholder submissions created successfully');
        } catch (error) {
          console.error('Error creating placeholder submissions:', error);
          toast({
            title: "Warning",
            description: "Assignment created but placeholder submissions failed. You can still grade students manually.",
            variant: "destructive"
          });
        }
      }
      
      // Call onSuccess to close the modal
      console.log('Assignment creation completed successfully, calling onSuccess()');
      onSuccess();
    } catch (error: any) {
      console.error('Error creating assignment:', error);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Create New Assignment</h2>
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
              <BookOpen className="h-5 w-5" />
              <span>Basic Information</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Assignment Title *</Label>
                <Input
                  id="title"
                  value={assignment.title}
                  onChange={(e) => setAssignment(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Letter Recognition - F to J"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="type">Assignment Type *</Label>
                <Select
                  value={assignment.type}
                  onValueChange={(value) => setAssignment(prev => ({ ...prev, type: value }))}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select assignment type" />
                  </SelectTrigger>
                                     <SelectContent>
                     {ASSIGNMENT_TYPES.map((type) => (
                       <SelectItem key={type.id} value={type.id} textValue={type.name}>
                         <div className="flex items-center space-x-2">
                           <span>{type.icon}</span>
                           <span>{type.name}</span>
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={assignment.description}
                onChange={(e) => setAssignment(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the assignment..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date *</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={assignment.dueDate}
                  onChange={(e) => setAssignment(prev => ({ ...prev, dueDate: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="points">Points</Label>
                <Input
                  id="points"
                  type="number"
                  min="1"
                  max="100"
                  value={assignment.points}
                  onChange={(e) => setAssignment(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="estimatedTime">Estimated Time (minutes)</Label>
                <Input
                  id="estimatedTime"
                  type="number"
                  min="5"
                  max="120"
                  value={assignment.estimatedTime}
                  onChange={(e) => setAssignment(prev => ({ ...prev, estimatedTime: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>

            {/* In-Class Grade Toggle */}
            <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
              <Switch
                id="inClassGraded"
                checked={isInClassGraded}
                onCheckedChange={handleInClassGradedChange}
              />
              <div className="space-y-1">
                <Label htmlFor="inClassGraded" className="text-sm font-medium">
                  Auto-Submit for All Students
                </Label>
                <p className="text-xs text-muted-foreground">
                  Check this to automatically create submissions for all students in the class. 
                  You can then grade each student individually later through the submissions view.
                </p>
              </div>
            </div>

            {/* Auto-submit preview */}
            {isInClassGraded && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="space-y-2">
                    <h4 className="font-medium text-blue-800">Auto-Submit Enabled</h4>
                    <p className="text-sm text-blue-700">
                      When this assignment is created, submissions will be automatically generated for all students in the class.
                    </p>
                    <div className="text-xs text-blue-600 space-y-1">
                      <p>✅ All students will have placeholder submissions</p>
                      <p>✅ You can grade each student individually</p>
                      <p>✅ Students can still submit additional work if needed</p>
                      <p>✅ Perfect for in-class activities and participation grades</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Assignment Type Details */}
        {assignment.type && (
          <Card>
            <CardHeader>
              <CardTitle>Assignment Type Details</CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const selectedType = ASSIGNMENT_TYPES.find(t => t.id === assignment.type);
                if (!selectedType) return null;
                
                return (
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                    <span className="text-2xl">{selectedType.icon}</span>
                    <div>
                      <h4 className="font-medium">{selectedType.name}</h4>
                      <p className="text-sm text-muted-foreground">{selectedType.description}</p>
                    </div>
                    <Badge className={selectedType.color}>{selectedType.name}</Badge>
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <Card>
          <CardHeader>
            <CardTitle>Instructions for Students & Parents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="instructions">Detailed Instructions</Label>
              <Textarea
                id="instructions"
                value={assignment.instructions}
                onChange={(e) => setAssignment(prev => ({ ...prev, instructions: e.target.value }))}
                placeholder="Provide clear, step-by-step instructions for students and parents..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                These instructions will be visible to parents and students when they view the assignment.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Supporting Materials</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-upload">Upload Files</Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center hover:border-muted-foreground/50 transition-colors">
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-2">
                  Drag and drop files here, or click to browse
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
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi"
                  aria-label="Upload assignment files"
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
                        <File className="h-5 w-5 text-muted-foreground" />
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
              Supported formats: PDF, Word, PowerPoint, Images (JPG, PNG, GIF), Videos (MP4, MOV, AVI)
            </p>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isCreating} className="bg-green-600 hover:bg-green-700 text-white">
            {isCreating ? "Creating..." : "Create Assignment"}
          </Button>
        </div>
      </form>


    </div>
  );
};
