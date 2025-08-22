import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ClassService } from '@/lib/services/classes';

interface ClassCreationProps {
  teachers: any[];
  onSuccess: () => void;
}

export const ClassCreation: React.FC<ClassCreationProps> = ({ teachers, onSuccess }) => {
  const [newClass, setNewClass] = useState({
    name: "",
    grade: "",
    academicYear: new Date().getFullYear().toString(),
    teacherId: ""
  });
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  const handleCreateClass = async () => {
    if (!newClass.name || !newClass.grade || !newClass.teacherId) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      // Create the class
      const classId = await ClassService.createClass({
        name: newClass.name,
        grade: newClass.grade,
        academicYear: newClass.academicYear,
        teacherId: newClass.teacherId,
        students: [],
        isActive: true
      });

      toast({
        title: "Class Created!",
        description: `Class ${newClass.name} created and assigned to teacher successfully.`,
      });

      // Reset form
      setNewClass({
        name: "",
        grade: "",
        academicYear: new Date().getFullYear().toString(),
        teacherId: ""
      });

      // Call success callback
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Class Creation Failed",
        description: error.message || "Something went wrong.",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="class-name">Class Name *</Label>
          <Input
            id="class-name"
            placeholder="e.g., Kindergarten A"
            value={newClass.name}
            onChange={(e) => setNewClass(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="class-grade">Grade *</Label>
          <Input
            id="class-grade"
            placeholder="e.g., K, 1, 2"
            value={newClass.grade}
            onChange={(e) => setNewClass(prev => ({ ...prev, grade: e.target.value }))}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="class-year">Academic Year</Label>
          <Input
            id="class-year"
            type="number"
            placeholder="2024"
            value={newClass.academicYear}
            onChange={(e) => setNewClass(prev => ({ ...prev, academicYear: e.target.value }))}
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="class-teacher">Assign Teacher *</Label>
          <Select
            value={newClass.teacherId}
            onValueChange={(value) => setNewClass(prev => ({ ...prev, teacherId: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((teacher) => (
                <SelectItem key={teacher.uid} value={teacher.uid}>
                  {teacher.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex justify-end space-x-2">
        <Button 
          onClick={handleCreateClass} 
          disabled={isCreating}
          className="px-8"
        >
          {isCreating ? "Creating..." : "Create Class"}
        </Button>
      </div>
    </div>
  );
};
