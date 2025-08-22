import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  User as FirebaseUser,
  setPersistence,
  browserLocalPersistence,
  signOut as firebaseSignOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { User } from '../types';
import { UsernameService } from './username';

export class AuthService {
  // Initialize Firebase Auth with permanent persistence
  static async initializeAuth() {
    try {
      // Set persistence to LOCAL (permanent) - user stays logged in forever
      await setPersistence(auth, browserLocalPersistence);
    } catch (error) {
      console.error('Auth initialization error:', error);
    }
  }

  // Sign in with username and password
  static async signIn(username: string, password: string): Promise<User> {
    try {
      console.log("1. Starting sign in for username:", username);
      
      // Validate required fields
      if (!username || username.trim() === '') {
        throw new Error('Username is required');
      }
      
      if (!password || password.trim() === '') {
        throw new Error('Password is required');
      }

      console.log("2. Getting UID from username...");
      // First, get the UID associated with the username
      const uid = await UsernameService.getUserByUsername(username.trim());
      console.log("3. UID found:", uid);
      
      if (!uid) {
        throw new Error('Username not found');
      }

      console.log("4. Getting user data from Firestore...");
      console.log("4a. UID to look up:", uid);
      console.log("4b. Document path: users/" + uid);
      
      let userDoc;
      try {
        // Get the user data to find the stored dummy email
        userDoc = await getDoc(doc(db, 'users', uid));
        console.log("5. User doc exists:", userDoc.exists());
      } catch (firestoreError) {
        console.error("5a. Firestore read error:", firestoreError);
        console.error("5b. Error code:", firestoreError.code);
        console.error("5c. Error message:", firestoreError.message);
        throw firestoreError;
      }
      
      if (!userDoc.exists()) {
        throw new Error('User profile not found');
      }
      
      const userData = userDoc.data() as User;
      const storedEmail = userData.email;
      console.log("6. Stored email:", storedEmail);

      console.log("7. Signing in with Firebase Auth...");
      // Sign in with Firebase Auth using the stored dummy email
      const userCredential = await signInWithEmailAndPassword(auth, storedEmail, password);
      const user = userCredential.user;
      console.log("8. Firebase Auth successful, UID:", user.uid);
      
      // Verify the UID matches
      if (user.uid !== uid) {
        throw new Error('Authentication failed');
      }
      
      console.log("9. Updating last login...");
      // Update last login
      await updateDoc(doc(db, 'users', uid), {
        lastLoginAt: new Date()
      });
      
      console.log("10. Sign in complete!");
      return userData;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  // Create new user account with username
  static async signUp(username: string, password: string, userData: Partial<User>): Promise<User> {
    try {
      // Validate required fields
      if (!username || username.trim() === '') {
        throw new Error('Username is required');
      }
      
      if (!password || password.trim() === '') {
        throw new Error('Password is required');
      }
      
      if (!userData.role) {
        throw new Error('User role is required');
      }
      
      if (!userData.displayName || userData.displayName.trim() === '') {
        throw new Error('Display name is required');
      }

      // Validate username format
      const usernameValidation = UsernameService.validateUsername(username);
      if (!usernameValidation.isValid) {
        throw new Error(usernameValidation.message || 'Invalid username format');
      }

      // Check if username is available
      const isAvailable = await UsernameService.isUsernameAvailable(username);
      if (!isAvailable) {
        throw new Error('Username is already taken');
      }

      // Generate a unique dummy email for Firebase Auth (hidden from users)
      const timestamp = Date.now();
      const dummyEmail = `${username}_${timestamp}@kindyreach.local`;

      // Create user in Firebase Auth using the dummy email
      const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, password);
      const user = userCredential.user;
      
      // Create user object with only essential fields
      const newUser: any = { // Change to 'any' or create proper interface
        uid: user.uid,
        username: username.trim(),
        email: dummyEmail,
        role: userData.role,
        displayName: userData.displayName.trim(),
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true
      };
      
      // Only add classId if it's provided
      if (userData.classId) {
        newUser.classId = userData.classId;
      }
      
      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), newUser);
      
      // Reserve the username
      await UsernameService.reserveUsername(username, user.uid);
      
      return newUser as User;
    } catch (error: any) {
      console.error('Sign up error:', error);
      
      // Provide better error messages
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Username is already taken');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Username contains invalid characters');
      } else {
        throw error;
      }
    }
  }

  // Create new user account with username (for admin) - without triggering auth state change
  static async createUserAsAdmin(username: string, password: string, userData: Partial<User>, adminPassword: string): Promise<User> {
    try {
      // Validate required fields
      if (!username || username.trim() === '') {
        throw new Error('Username is required');
      }
      
      if (!password || password.trim() === '') {
        throw new Error('Password is required');
      }
      
      if (!userData.role) {
        throw new Error('User role is required');
      }
      
      if (!userData.displayName || userData.displayName.trim() === '') {
        throw new Error('Display name is required');
      }

      if (!adminPassword || adminPassword.trim() === '') {
        throw new Error('Admin password is required');
      }

      // Validate username format
      const usernameValidation = UsernameService.validateUsername(username);
      if (!usernameValidation.isValid) {
        throw new Error(usernameValidation.message || 'Invalid username format');
      }

      // Check if username is available
      const isAvailable = await UsernameService.isUsernameAvailable(username);
      if (!isAvailable) {
        throw new Error('Username is already taken');
      }

      // Store the current admin user's credentials before creating new user
      const currentAdminUser = auth.currentUser;
      if (!currentAdminUser) {
        throw new Error('Admin must be authenticated to create users');
      }

      // Get admin's stored email from Firestore to re-authenticate
      const adminDoc = await getDoc(doc(db, 'users', currentAdminUser.uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin profile not found');
      }
      const adminData = adminDoc.data() as User;
      const adminEmail = adminData.email;

      // Generate a unique dummy email for Firebase Auth (hidden from users)
      const timestamp = Date.now();
      const dummyEmail = `${username}_${timestamp}@kindyreach.local`;

      // Create user in Firebase Auth using the dummy email
      const userCredential = await createUserWithEmailAndPassword(auth, dummyEmail, password);
      const user = userCredential.user;
      
      // Create user object with only essential fields
      const newUser = {
        uid: user.uid,
        username: username.trim(),
        email: dummyEmail,
        role: userData.role,
        displayName: userData.displayName.trim(),
        createdAt: new Date(),
        lastLoginAt: new Date(),
        isActive: true,
        classId: userData.classId || null
      };
      
      // Save user data to Firestore
      await setDoc(doc(db, 'users', user.uid), newUser);
      
      // Reserve the username
      await UsernameService.reserveUsername(username, user.uid);
      
      // CRITICAL: Immediately re-authenticate the admin to prevent logout
      // The new user was automatically signed in, so we need to sign them out
      // and sign the admin back in
      await firebaseSignOut(auth);
      
      // Now re-authenticate the admin using their password
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      } catch (authError) {
        console.error('Failed to re-authenticate admin:', authError);
        throw new Error('Failed to re-authenticate admin. Please sign in again.');
      }
      
      return newUser as User;
    } catch (error: any) {
      console.error('Create user error:', error);
      
      // Provide better error messages
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('Username is already taken');
      } else if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak');
      } else if (error.code === 'auth/invalid-email') {
        throw new Error('Username contains invalid characters');
      } else {
        throw error;
      }
    }
  }

  // Sign out
  static async signOut(): Promise<void> {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Get current user from Firebase Auth
  static getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  // Listen to auth state changes
  static onAuthStateChange(callback: (user: FirebaseUser | null) => void) {
    return onAuthStateChanged(auth, callback);
  }

  // Get user data from Firestore
  static async getUserData(uid: string): Promise<User> {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      return userDoc.data() as User;
    } catch (error) {
      console.error('Get user data error:', error);
      throw error;
    }
  }

  // Check if user is authenticated (will always return true if they were ever logged in)
  static isAuthenticated(): boolean {
    return auth.currentUser !== null;
  }

  // Get current user's UID
  static getCurrentUserId(): string | null {
    return auth.currentUser?.uid || null;
  }

  // Delete user account (admin only)
  static async deleteUserAsAdmin(userId: string, adminPassword: string): Promise<void> {
    try {
      // Validate admin password first
      const currentAdminUser = auth.currentUser;
      if (!currentAdminUser) {
        throw new Error('Admin must be authenticated to delete users');
      }

      // Get admin's stored email from Firestore to verify
      const adminDoc = await getDoc(doc(db, 'users', currentAdminUser.uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin profile not found');
      }
      const adminData = adminDoc.data() as User;
      const adminEmail = adminData.email;

      // Verify admin password
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      } catch (authError) {
        throw new Error('Invalid admin password');
      }

      // Get user data before deletion
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      const userData = userDoc.data() as User;

      // Create a batch to handle multiple operations
      const batch = writeBatch(db);

      // Mark user as inactive instead of deleting
      batch.update(doc(db, 'users', userId), {
        isActive: false,
        deletedAt: new Date(),
        deletedBy: currentAdminUser.uid,
        status: 'deleted'
      });

      // If it's a parent user, also mark their student as inactive
      if (userData.role === 'parent') {
        // Find and update the student record
        const studentsQuery = query(
          collection(db, 'students'),
          where('parentId', '==', userId)
        );
        const studentsSnapshot = await getDocs(studentsQuery);
        
        studentsSnapshot.docs.forEach(studentDoc => {
          batch.update(doc(db, 'students', studentDoc.id), {
            isActive: false,
            deletedAt: new Date(),
            deletedBy: currentAdminUser.uid
          });
        });
      }

      // Remove username reservation
      if (userData.username) {
        batch.delete(doc(db, 'usernames', userData.username));
      }

      // Commit all changes
      await batch.commit();

      // Re-authenticate admin
      await firebaseSignOut(auth);
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

    } catch (error: any) {
      console.error('Delete user error:', error);
      throw error;
    }
  }

  // Reset user password (admin only)
  static async resetUserPasswordAsAdmin(userId: string, newPassword: string, adminPassword: string): Promise<void> {
    try {
      // Validate admin password first
      const currentAdminUser = auth.currentUser;
      if (!currentAdminUser) {
        throw new Error('Admin must be authenticated to reset passwords');
      }

      // Get admin's stored email from Firestore to verify
      const adminDoc = await getDoc(doc(db, 'users', currentAdminUser.uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin profile not found');
      }
      const adminData = adminDoc.data() as User;
      const adminEmail = adminData.email;

      // Verify admin password
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      } catch (authError) {
        throw new Error('Invalid admin password');
      }

      // Get user data to find their email
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (!userDoc.exists()) {
        throw new Error('User not found');
      }
      const userData = userDoc.data() as User;
      const userEmail = userData.email;

      // Note: Firebase Auth password reset for other users requires the Admin SDK
      // For now, we'll store the new password in Firestore and show it to the admin
      // The user will need to use this password to sign in
      
      // Update the user's password in Firestore (this is a temporary solution)
      await updateDoc(doc(db, 'users', userId), {
        password: newPassword, // Store the new password temporarily
        passwordUpdatedAt: new Date(),
        passwordUpdatedBy: currentAdminUser.uid
      });

      // Re-authenticate admin
      await firebaseSignOut(auth);
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

      console.log(`Password reset for user ${userData.displayName}. New password: ${newPassword}`);
      
    } catch (error: any) {
      console.error('Reset password error:', error);
      throw error;
    }
  }

  // Update student information (admin only)
  static async updateStudentAsAdmin(studentId: string, updates: any, adminPassword: string): Promise<void> {
    try {
      // Validate admin password first
      const currentAdminUser = auth.currentUser;
      if (!currentAdminUser) {
        throw new Error('Admin must be authenticated to update students');
      }

      // Get admin's stored email from Firestore to verify
      const adminDoc = await getDoc(doc(db, 'users', currentAdminUser.uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin profile not found');
      }
      const adminData = adminDoc.data() as User;
      const adminEmail = adminData.email;

      // Verify admin password
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      } catch (authError) {
        throw new Error('Invalid admin password');
      }

      // Update student information
      await updateDoc(doc(db, 'students', studentId), {
        ...updates,
        updatedAt: new Date(),
        updatedBy: currentAdminUser.uid
      });

      // Re-authenticate admin
      await firebaseSignOut(auth);
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

    } catch (error: any) {
      console.error('Update student error:', error);
      throw error;
    }
  }

  // Update user information (admin only)
  static async updateUserAsAdmin(userId: string, updates: Partial<User>, adminPassword: string): Promise<void> {
    try {
      // Validate admin password first
      const currentAdminUser = auth.currentUser;
      if (!currentAdminUser) {
        throw new Error('Admin must be authenticated to update users');
      }

      // Get admin's stored email from Firestore to verify
      const adminDoc = await getDoc(doc(db, 'users', currentAdminUser.uid));
      if (!adminDoc.exists()) {
        throw new Error('Admin profile not found');
      }
      const adminData = adminDoc.data() as User;
      const adminEmail = adminData.email;

      // Verify admin password
      try {
        await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
      } catch (authError) {
        throw new Error('Invalid admin password');
      }

      // Update user data in Firestore
      await updateDoc(doc(db, 'users', userId), updates);

      // Re-authenticate admin
      await firebaseSignOut(auth);
      await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

    } catch (error: any) {
      console.error('Update user error:', error);
      throw error;
    }
  }
}


