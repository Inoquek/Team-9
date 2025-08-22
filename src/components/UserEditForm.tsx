import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User } from '@/lib/types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Student {
  id: string;
  name: string;
  grade: string;
  classId: string | null;
  isActive: boolean;
}

interface UserEditFormProps {
  user: User;
  classes: any[];
  onSave: (updatedUser: User & { adminPassword: string; newPassword?: string; studentUpdates?: Partial<Student> }) => void;
  onCancel: () => void;
}

export const UserEditForm: React.FC<UserEditFormProps> = ({ user, classes, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    displayName: user.displayName,
    role: user.role,
    classId: user.classId || 'none',
    adminPassword: '',
    newPassword: ''
  });

  const [studentData, setStudentData] = useState<Student | null>(null);
  const [isLoadingStudent, setIsLoadingStudent] = useState(false);

  // Load student data if user is a parent
  useEffect(() => {
    if (user.role === 'parent') {
      loadStudentData();
    }
  }, [user.uid]);

  const loadStudentData = async () => {
    setIsLoadingStudent(true);
    try {
      const studentsQuery = query(
        collection(db, 'students'),
        where('parentId', '==', user.uid),
        where('isActive', '==', true)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      
      if (!studentsSnapshot.empty) {
        const studentDoc = studentsSnapshot.docs[0];
        const student = { id: studentDoc.id, ...studentDoc.data() } as Student;
        setStudentData(student);
      }
    } catch (error) {
      console.error('Error loading student data:', error);
    } finally {
      setIsLoadingStudent(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.adminPassword.trim()) {
      alert('Admin password is required');
      return;
    }

    // Prepare updates
    const updates: any = {
      ...user,
      ...formData
    };

    // Add student updates if available
    if (studentData && formData.role === 'parent') {
      updates.studentUpdates = {
        name: studentData.name,
        grade: studentData.grade,
        classId: studentData.classId
      };
    }

    // Add new password if provided
    if (formData.newPassword.trim()) {
      updates.newPassword = formData.newPassword;
    }

    onSave(updates);
  };

  const generateNewPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData(prev => ({ ...prev, newPassword: password }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="edit-displayName">Display Name</Label>
        <Input
          id="edit-displayName"
          value={formData.displayName}
          onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="edit-role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value: "parent" | "teacher" | "admin") => 
            setFormData(prev => ({ ...prev, role: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="parent">👨‍👩‍👧‍👦 Parent</SelectItem>
            <SelectItem value="teacher">🏫 Teacher</SelectItem>
            <SelectItem value="admin">👑 Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-classId">Class Assignment</Label>
        <Select
          value={formData.classId}
          onValueChange={(value) => setFormData(prev => ({ ...prev, classId: value }))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a class" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Class</SelectItem>
            {classes.map((cls) => (
              <SelectItem key={cls.id} value={cls.id}>
                {cls.name} - Grade {cls.grade}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Password Change Section */}
      <div className="space-y-2">
        <Label htmlFor="edit-newPassword">New Password (Optional)</Label>
        <div className="flex space-x-2">
          <Input
            id="edit-newPassword"
            type="text"
            placeholder="Leave empty to keep current password"
            value={formData.newPassword}
            onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
          />
          <Button
            type="button"
            variant="outline"
            onClick={generateNewPassword}
            className="whitespace-nowrap"
          >
            Generate
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Generate a new password for the user. Leave empty to keep the current password.
        </p>
      </div>

      {/* Student Information Section (for parent users) */}
      {user.role === 'parent' && studentData && (
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium">Student Information</h4>
          
          {isLoadingStudent ? (
            <p className="text-sm text-muted-foreground">Loading student data...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-student-name">Student Name</Label>
                <Input
                  id="edit-student-name"
                  value={studentData.name}
                  onChange={(e) => setStudentData(prev => prev ? { ...prev, name: e.target.value } : null)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-student-grade">Student Grade</Label>
                <Input
                  id="edit-student-grade"
                  value={studentData.grade}
                  onChange={(e) => setStudentData(prev => prev ? { ...prev, grade: e.target.value } : null)}
                  required
                />
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="edit-student-class">Student Class</Label>
                <Select
                  value={studentData.classId || 'none'}
                  onValueChange={(value) => setStudentData(prev => prev ? { ...prev, classId: value === 'none' ? null : value } : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No Class</SelectItem>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} - Grade {cls.grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="edit-adminPassword">Admin Password</Label>
        <Input
          id="edit-adminPassword"
          type="password"
          placeholder="Enter your admin password to confirm changes"
          value={formData.adminPassword}
          onChange={(e) => setFormData(prev => ({ ...prev, adminPassword: e.target.value }))}
          required
        />
        <p className="text-xs text-muted-foreground">
          Required to confirm your changes
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="submit" className="flex-1">
          Save Changes
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
      </div>
    </form>
  );
};
