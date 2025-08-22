import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { AuthService } from '@/lib/services/auth';
import { Users } from 'lucide-react';
import { User } from '@/lib/types';
import { collection, query, getDocs, where, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserEditForm } from './UserEditForm';

interface UserManagementProps {
  classes: any[];
  onBack?: () => void; // 添加可选的 onBack prop
}

export const UserManagement: React.FC<UserManagementProps> = ({ onBack, classes }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");
  const [userFilterRole, setUserFilterRole] = useState("all");
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { toast } = useToast();

  // Filtered users for management
  const filteredUsers = users.filter(user => {
    try {
      const matchesSearch = userSearchTerm === '' || 
                           user.displayName?.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
                           user.username?.toLowerCase().includes(userSearchTerm.toLowerCase());
      const matchesRole = userFilterRole === 'all' || user.role === userFilterRole;
      
      return matchesSearch && matchesRole;
    } catch (error) {
      console.error('Error filtering user:', user, error);
      return false;
    }
  });

  // Load users for management
  const loadUsers = async () => {
    console.log('loadUsers called');
    setIsLoadingUsers(true);
    try {
      console.log('Querying users from Firestore...');
      const usersQuery = query(
        collection(db, 'users')
      );
      const usersSnapshot = await getDocs(usersQuery);
      console.log('Users snapshot:', usersSnapshot.docs.length, 'users found');
      
      const usersData = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        console.log('User data:', doc.id, data);
        return {
          uid: doc.id,
          ...data
        };
      }).filter(user => (user as any).isActive !== false);
      
      console.log('Filtered users:', usersData.length, 'active users');
      console.log('Setting users state:', usersData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error loading users:', error);
      toast({
        title: "Error Loading Users",
        description: "Failed to load users. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // User management handlers
  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsEditingUser(true);
  };

  const handleDeleteUser = async (user: User) => {
    if (window.confirm(`Are you sure you want to delete ${user.displayName}? This action cannot be undone.`)) {
      const adminPassword = prompt("Enter your admin password to confirm deletion:");
      if (!adminPassword) return;
      
      try {
        await AuthService.deleteUserAsAdmin(user.uid, adminPassword);
        toast({
          title: "User Deleted",
          description: `${user.displayName} has been deleted successfully.`,
        });
        // Refresh users list
        await loadUsers();
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to delete user. Please try again.",
          variant: "destructive"
        });
      }
    }
  };

  // 修复日期格式化函数
  const formatUserDate = (createdAt: any) => {
    try {
      // 处理 Firestore Timestamp
      if (createdAt && typeof createdAt.toDate === 'function') {
        return createdAt.toDate().toLocaleDateString();
      }
      // 处理普通 Date 对象
      else if (createdAt instanceof Date) {
        return createdAt.toLocaleDateString();
      }
      // 处理时间戳或字符串
      else if (createdAt) {
        return new Date(createdAt).toLocaleDateString();
      }
      return 'Unknown';
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Unknown';
    }
  };

  // Load users when component mounts
  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="space-y-6">
      {/* Back button (如果提供了 onBack prop) */}
      {onBack && (
        <Button variant="outline" onClick={onBack}>
          ← Back
        </Button>
      )}

      {/* Search and Filter */}
      <div className="flex gap-4">
        <Input
          placeholder="Search users by name or username..."
          className="flex-1 max-w-md"
          value={userSearchTerm}
          onChange={(e) => setUserSearchTerm(e.target.value)}
        />
        <Select value={userFilterRole} onValueChange={setUserFilterRole}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="parent">Parent</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          onClick={loadUsers}
          disabled={isLoadingUsers}
        >
          {isLoadingUsers ? "Loading..." : "Refresh"}
        </Button>
      </div>

      {/* Users List */}
      <div className="space-y-4">
        {isLoadingUsers ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No users found</p>
            <p className="text-sm">Users will appear here once they are created</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">No users match your search</p>
            <p className="text-sm">Try adjusting your search terms or filters</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredUsers.map((user) => (
              <div key={user.uid} className="p-4 border rounded bg-white shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 text-xs rounded bg-blue-200">{user.role}</span>
                      <span className="font-medium">{user.displayName}</span>
                      <span className="text-sm text-muted-foreground">@{user.username}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Created: {formatUserDate(user.createdAt)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditUser(user)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteUser(user)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Debug Info */}
      <div className="text-xs text-muted-foreground border-t pt-4">
        <p>Total users: {users.length}</p>
        <p>Filtered users: {filteredUsers.length}</p>
        <p>Search term: "{userSearchTerm}"</p>
        <p>Role filter: "{userFilterRole === 'all' ? 'All' : userFilterRole}"</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            console.log('Current users state:', users);
            console.log('Current filteredUsers state:', filteredUsers);
          }}
          className="mt-2"
        >
          Debug: Log Users
        </Button>
      </div>

      {/* User Edit Dialog */}
      <Dialog open={isEditingUser} onOpenChange={setIsEditingUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User: {editingUser?.displayName}</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <UserEditForm 
              user={editingUser} 
              classes={classes}
              onSave={async (updatedUser) => {
                try {
                  // Handle user updates
                  await AuthService.updateUserAsAdmin(updatedUser.uid, {
                    displayName: updatedUser.displayName,
                    role: updatedUser.role,
                    classId: updatedUser.classId === 'none' ? null : updatedUser.classId
                  }, updatedUser.adminPassword);

                  // Handle password change if provided
                  if (updatedUser.newPassword) {
                    await AuthService.resetUserPasswordAsAdmin(
                      updatedUser.uid, 
                      updatedUser.newPassword, 
                      updatedUser.adminPassword
                    );
                    
                    // Show the new password to the admin
                    toast({
                      title: "Password Reset",
                      description: `New password for ${updatedUser.displayName}: ${updatedUser.newPassword}`,
                      duration: 10000, // Show for 10 seconds
                    });
                  }

                  // Handle student updates if available
                  if (updatedUser.studentUpdates && updatedUser.role === 'parent') {
                    try {
                      // Find the student record
                      const studentsQuery = query(
                        collection(db, 'students'),
                        where('parentId', '==', updatedUser.uid),
                        where('isActive', '==', true)
                      );
                      const studentsSnapshot = await getDocs(studentsQuery);
                      
                      if (!studentsSnapshot.empty) {
                        const studentDoc = studentsSnapshot.docs[0];
                        await updateDoc(doc(db, 'students', studentDoc.id), {
                          name: updatedUser.studentUpdates.name,
                          grade: updatedUser.studentUpdates.grade,
                          classId: updatedUser.studentUpdates.classId
                        });
                      }
                    } catch (error) {
                      console.error('Error updating student:', error);
                      // Don't fail the entire operation if student update fails
                    }
                  }
                  
                  toast({
                    title: "User Updated",
                    description: `${updatedUser.displayName} has been updated successfully.`,
                  });
                  
                  setIsEditingUser(false);
                  setEditingUser(null);
                  await loadUsers();
                } catch (error: any) {
                  toast({
                    title: "Error",
                    description: error.message || "Failed to update user. Please try again.",
                    variant: "destructive"
                  });
                }
              }}
              onCancel={() => {
                setIsEditingUser(false);
                setEditingUser(null);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};