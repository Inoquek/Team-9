import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth';
import { StudentService } from '@/lib/services/students';
import { ClassService } from '@/lib/services/classes';

interface UserCreationProps {
  classes: any[];
  onSuccess: () => void;
}

export const UserCreation: React.FC<UserCreationProps> = ({ classes, onSuccess }) => {
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    role: "parent" as "parent" | "teacher" | "admin",
    displayName: "",
    studentName: "",
    studentGrade: "",
    classId: "",
    adminPassword: ""
  });
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  // Generate random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUser(prev => ({ ...prev, password }));
  };

  const handleCreateUser = async () => {
    // Validation
    const errors = [];
    
    if (!newUser.username || newUser.username.trim() === '') {
      errors.push('Username is required');
    }
    
    if (!newUser.password || newUser.password.trim() === '') {
      errors.push('Password is required');
    }
    
    if (!newUser.displayName || newUser.displayName.trim() === '') {
      errors.push('Display name is required');
    }
    
    if (!newUser.role) {
      errors.push('User role is required');
    }

    // Admin password is required
    if (!newUser.adminPassword || newUser.adminPassword.trim() === '') {
      errors.push('Admin password is required');
    }

    // Additional validation for parent users
    if (newUser.role === "parent") {
      if (!newUser.studentName || newUser.studentName.trim() === '') {
        errors.push('Student name is required');
      }
      if (!newUser.studentGrade || newUser.studentGrade.trim() === '') {
        errors.push('Student grade is required');
      }
      if (!newUser.classId) {
        errors.push('Class assignment is required');
      }
    }

    if (errors.length > 0) {
      toast({
        title: "Missing Information",
        description: errors.join(', '),
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);

    try {
      // Create the user account
      const userData = await AuthService.createUserAsAdmin(
        newUser.username.trim(), 
        newUser.password, 
        { 
          role: newUser.role, 
          displayName: newUser.displayName.trim()
        },
        newUser.adminPassword
      );

      // If it's a parent user, create the student record
      if (newUser.role === "parent") {
        const studentId = await StudentService.createStudent({
          name: newUser.studentName.trim(),
          parentId: userData.uid,
          classId: newUser.classId,
          grade: newUser.studentGrade.trim(),
          isActive: true
        });

        // Add student to class - use the student's ID, not the parent's
        await ClassService.addStudentToClass(studentId, newUser.classId);
      }

      toast({
        title: "User Created Successfully!",
        description: `Account created for ${newUser.displayName}. Username: ${newUser.username}`,
      });

      // Reset form
      setNewUser({
        username: "",
        password: "",
        role: "parent",
        displayName: "",
        studentName: "",
        studentGrade: "",
        classId: "",
        adminPassword: ""
      });

      onSuccess();
    } catch (error: any) {
      let errorMessage = "Something went wrong. Please try again.";
      
      if (error.message) {
        if (error.message.includes('Username is already taken')) {
          errorMessage = "This username is already taken. Please choose a different username.";
        } else if (error.message.includes('Password is too weak')) {
          errorMessage = "Password is too weak. Please use a stronger password.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "User Creation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Role Selection */}
      <div className="space-y-2">
        <Label htmlFor="role">User Role *</Label>
        <Select
          value={newUser.role}
          onValueChange={(value: "parent" | "teacher" | "admin") => 
            setNewUser(prev => ({ ...prev, role: value }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="parent">👨‍👩‍👧‍👦 Parent</SelectItem>
            <SelectItem value="teacher">🏫 Teacher</SelectItem>
            <SelectItem value="admin">👑 Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Display Name */}
        <div className="space-y-2">
          <Label htmlFor="displayName">Full Name *</Label>
          <Input
            id="displayName"
            placeholder="Enter full name"
            value={newUser.displayName}
            onChange={(e) => setNewUser(prev => ({ ...prev, displayName: e.target.value }))}
            required
          />
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username">Username *</Label>
          <Input
            id="username"
            placeholder="Choose username"
            value={newUser.username}
            onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
            required
          />
        </div>
      </div>

      {/* Password */}
      <div className="space-y-2">
        <Label htmlFor="password">Password *</Label>
        <div className="flex space-x-2">
          <Input
            id="password"
            type="text"
            placeholder="Generate or enter password"
            value={newUser.password}
            onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
            required
          />
          <Button
            type="button"
            variant="outline"
            onClick={generatePassword}
            className="whitespace-nowrap"
          >
            Generate
          </Button>
        </div>
      </div>

      {/* Student Information (Only for Parent Users) */}
      {newUser.role === "parent" && (
        <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium">Student Information</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="student-name">Student Name *</Label>
              <Input
                id="student-name"
                placeholder="Enter student's full name"
                value={newUser.studentName}
                onChange={(e) => setNewUser(prev => ({ ...prev, studentName: e.target.value }))}
                required={newUser.role === "parent"}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="student-grade">Student Grade *</Label>
              <Input
                id="student-grade"
                placeholder="e.g., K, 1, 2"
                value={newUser.studentGrade}
                onChange={(e) => setNewUser(prev => ({ ...prev, studentGrade: e.target.value }))}
                required={newUser.role === "parent"}
              />
            </div>
            
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="student-class">Assign to Class *</Label>
              <Select
                value={newUser.classId}
                onValueChange={(value) => setNewUser(prev => ({ ...prev, classId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.length > 0 ? (
                    classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id}>
                        {cls.name} - Grade {cls.grade} (Teacher: {cls.teacherName || 'Unassigned'})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-classes" disabled>
                      No classes available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {classes.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Create a class first before creating parent accounts
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Admin Password Field */}
      <div className="space-y-2">
        <Label htmlFor="adminPassword">Admin Password *</Label>
        <Input
          id="adminPassword"
          type="password"
          placeholder="Enter your admin password to confirm"
          value={newUser.adminPassword}
          onChange={(e) => setNewUser(prev => ({ ...prev, adminPassword: e.target.value }))}
          required
        />
        <p className="text-xs text-muted-foreground">
          Required to maintain your admin session when creating users
        </p>
      </div>

      <div className="flex justify-end space-x-2">
        <Button 
          onClick={handleCreateUser} 
          disabled={isCreating}
          className="px-8"
        >
          {isCreating ? "Creating..." : "Create User Account"}
        </Button>
      </div>
    </div>
  );
};
