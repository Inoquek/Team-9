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
          Record grades for students who performed well in class. Students with 0 points will not be graded.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Students Grades Table */}
        <div className="space-y-4">
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
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Students to be graded: <span className="font-medium text-foreground">
                {grades.filter(g => g.points > 0).length}
              </span> of {students.length}
            </div>
            <div className="text-sm text-muted-foreground">
              Total points to award: <span className="font-medium text-foreground">
                {grades.reduce((sum, g) => sum + g.points, 0)}
              </span>
            </div>
          </div>
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
