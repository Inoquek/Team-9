import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { SubmissionService } from '@/lib/services/assignments';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { User, Star, Clock, MessageSquare, CheckCircle } from 'lucide-react';

interface InClassGradeFormProps {
  assignmentId: string;
  classId: string;
  teacherId: string;
  maxPoints: number;
  onSuccess: () => void;
  onCancel: () => void;
}

interface Student {
  id: string;
  name: string;
  grade: string;
}

interface GradeEntry {
  studentId: string;
  studentName: string;
  points: number;
  notes: string;
  completionTimeMinutes: number;
}

export const InClassGradeForm: React.FC<InClassGradeFormProps> = ({
  assignmentId,
  classId,
  teacherId,
  maxPoints,
  onSuccess,
  onCancel
}) => {
  const { toast } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<GradeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load students for the class
  useEffect(() => {
    const loadStudents = async () => {
      try {
        const studentsQuery = query(
          collection(db, 'students'),
          where('classId', '==', classId),
          where('isActive', '==', true)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        const studentsData = studentsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Student[];
        
        setStudents(studentsData);
        
        // Initialize grades array with all students
        const initialGrades: GradeEntry[] = studentsData.map(student => ({
          studentId: student.id,
          studentName: student.name,
          points: 0,
          notes: '',
          completionTimeMinutes: 0
        }));
        setGrades(initialGrades);
      } catch (error) {
        console.error('Error loading students:', error);
        toast({
          title: "Error",
          description: "Failed to load students. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadStudents();
  }, [classId, toast]);

  const handleGradeChange = (studentId: string, field: keyof GradeEntry, value: string | number) => {
    setGrades(prev => prev.map(grade => 
      grade.studentId === studentId 
        ? { ...grade, [field]: value }
        : grade
    ));
  };

  const handleSubmit = async () => {
    // Filter out students with 0 points (not graded)
    const validGrades = grades.filter(grade => grade.points > 0);
    
    if (validGrades.length === 0) {
      toast({
        title: "No grades to submit",
        description: "Please assign points to at least one student.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await SubmissionService.createBulkInClassGrades({
        assignmentId,
        grades: validGrades,
        teacherId
      });

      toast({
        title: "🎉 Grades submitted successfully!",
        description: `Grades have been recorded for ${validGrades.length} student(s).`,
      });

      onSuccess();
    } catch (error) {
      console.error('Error submitting grades:', error);
      toast({
        title: "Error",
        description: "Failed to submit grades. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getGradeColor = (points: number) => {
    const percentage = (points / maxPoints) * 100;
    if (percentage >= 90) return 'bg-green-100 text-green-800';
    if (percentage >= 80) return 'bg-blue-100 text-blue-800';
    if (percentage >= 70) return 'bg-yellow-100 text-yellow-800';
    if (percentage >= 60) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading students...</p>
        </div>
      </div>
    );
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          In-Class Grade Input
          <Badge variant="secondary" className="ml-auto">
            Max Points: {maxPoints}
          </Badge>
        </CardTitle>
        <p className="text-muted-foreground">
          Record individual grades for each student based on their in-class performance. 
          Students with 0 points will not be graded. You can give different grades to different students.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Students Grades Table */}
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Star className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Individual Grading</p>
                <p>Each student can receive different grades based on their individual performance. 
                Set points from 0 to {maxPoints} for each student. Students with 0 points will not be graded.</p>
              </div>
            </div>
          </div>
          
          {/* Quick Grading Presets */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium">Quick Grading:</span>
              <span className="text-xs text-muted-foreground">Click to apply grade patterns</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setGrades(prev => prev.map(grade => ({
                    ...grade,
                    points: Math.round(maxPoints * 0.9) // 90%
                  })));
                }}
                className="text-xs"
              >
                All Excellent (90%)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setGrades(prev => prev.map(grade => ({
                    ...grade,
                    points: Math.round(maxPoints * 0.8) // 80%
                  })));
                }}
                className="text-xs"
              >
                All Good (80%)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setGrades(prev => prev.map(grade => ({
                    ...grade,
                    points: Math.round(maxPoints * 0.7) // 70%
                  })));
                }}
                className="text-xs"
              >
                All Satisfactory (70%)
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setGrades(prev => prev.map(grade => ({
                    ...grade,
                    points: 0
                  })));
                }}
                className="text-xs"
              >
                Clear All Grades
              </Button>
            </div>
          </div>
          
          {/* Example Row */}
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-800">Example: Different Grades for Different Students</span>
            </div>
            <div className="text-xs text-green-700 space-y-1">
              <p>• Student A: 95 points (95%) - Outstanding participation and completed all tasks</p>
              <p>• Student B: 85 points (85%) - Good effort, completed most tasks correctly</p>
              <p>• Student C: 70 points (70%) - Satisfactory work, some areas need improvement</p>
              <p>• Student D: 0 points - Not graded (didn't participate or complete work)</p>
            </div>
          </div>
          
          <div className="grid grid-cols-12 gap-4 font-medium text-sm border-b pb-2">
            <div className="col-span-3">Student</div>
            <div className="col-span-2">Points</div>
            <div className="col-span-2">Time (min)</div>
            <div className="col-span-4">Notes</div>
            <div className="col-span-1">Grade</div>
          </div>
          
          {grades.map((grade) => (
            <div key={grade.studentId} className="grid grid-cols-12 gap-4 items-center border-b pb-4">
              {/* Student Name */}
              <div className="col-span-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{grade.studentName}</span>
                </div>
              </div>
              
              {/* Points */}
              <div className="col-span-2">
                <Input
                  type="number"
                  min="0"
                  max={maxPoints}
                  value={grade.points}
                  onChange={(e) => handleGradeChange(grade.studentId, 'points', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-20"
                />
              </div>
              
              {/* Completion Time */}
              <div className="col-span-2">
                <Input
                  type="number"
                  min="0"
                  max="120"
                  value={grade.completionTimeMinutes}
                  onChange={(e) => handleGradeChange(grade.studentId, 'completionTimeMinutes', parseInt(e.target.value) || 0)}
                  placeholder="0"
                  className="w-20"
                />
              </div>
              
              {/* Notes */}
              <div className="col-span-4">
                <Textarea
                  value={grade.notes}
                  onChange={(e) => handleGradeChange(grade.studentId, 'notes', e.target.value)}
                  placeholder="Optional notes about performance..."
                  rows={2}
                  className="text-sm"
                />
              </div>
              
              {/* Grade Display */}
              <div className="col-span-1">
                {grade.points > 0 && (
                  <Badge className={getGradeColor(grade.points)}>
                    {Math.round((grade.points / maxPoints) * 100)}%
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-muted p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {grades.filter(g => g.points > 0).length}
              </div>
              <div className="text-sm text-muted-foreground">
                Students to be graded
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {grades.reduce((sum, g) => sum + g.points, 0)}
              </div>
              <div className="text-sm text-muted-foreground">
                Total points to award
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {grades.filter(g => g.points > 0).length > 0 
                  ? Math.round(grades.filter(g => g.points > 0).reduce((sum, g) => sum + g.points, 0) / grades.filter(g => g.points > 0).length)
                  : 0
                }
              </div>
              <div className="text-sm text-muted-foreground">
                Average points per graded student
              </div>
            </div>
          </div>
          
          {/* Grade Distribution */}
          {grades.filter(g => g.points > 0).length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h4 className="text-sm font-medium mb-2">Grade Distribution:</h4>
              <div className="flex flex-wrap gap-2">
                {grades.filter(g => g.points > 0).map((grade) => (
                  <Badge key={grade.studentId} variant="outline" className="text-xs">
                    {grade.studentName}: {grade.points}/{maxPoints} ({Math.round((grade.points / maxPoints) * 100)}%)
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || grades.filter(g => g.points > 0).length === 0}
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Star className="h-4 w-4 mr-2" />
                Submit Grades
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
