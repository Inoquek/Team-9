
import { 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    query, 
    where, 
    getDocs,
    writeBatch,
    deleteDoc
  } from 'firebase/firestore';
  import { db } from '../firebase';
  
  export class UsernameService {
    // Check if username is available
    static async isUsernameAvailable(username: string): Promise<boolean> {
      try {
        const q = query(
          collection(db, 'usernames'), 
          where('username', '==', username.toLowerCase())
        );
        const querySnapshot = await getDocs(q);
        return querySnapshot.empty;
      } catch (error) {
        console.error('Username check error:', error);
        return false;
      }
    }
  
    // Validate username format
    static validateUsername(username: string): { isValid: boolean; message?: string } {
      const minLength = 3;
      const maxLength = 20;
      const allowedChars = /^[a-zA-Z0-9_]+$/;
  
      if (username.length < minLength) {
        return {
          isValid: false,
          message: `Username must be at least ${minLength} characters long`
        };
      }
  
      if (username.length > maxLength) {
        return {
          isValid: false,
          message: `Username must be no more than ${maxLength} characters long`
        };
      }
  
      if (!allowedChars.test(username)) {
        return {
          isValid: false,
          message: 'Username can only contain letters, numbers, and underscores'
        };
      }
  
      if (username.startsWith('_') || username.endsWith('_')) {
        return {
          isValid: false,
          message: 'Username cannot start or end with an underscore'
        };
      }
  
      return { isValid: true };
    }
  
    // Reserve username for a user
    static async reserveUsername(username: string, uid: string): Promise<void> {
      try {
        const batch = writeBatch(db);
        
        // Add to usernames collection
        const usernameRef = doc(db, 'usernames', username.toLowerCase());
        batch.set(usernameRef, {
          username: username.toLowerCase(),
          uid: uid,
          reservedAt: new Date()
        });
  
        await batch.commit();
      } catch (error) {
        console.error('Reserve username error:', error);
        throw error;
      }
    }
  
    // Get user by username
    static async getUserByUsername(username: string): Promise<string | null> {
      try {
        console.log('UsernameService: Looking up username:', username);
        console.log('UsernameService: Looking up lowercase:', username.toLowerCase());
        
        // Use direct document read instead of query for better reliability
        const usernameRef = doc(db, 'usernames', username.toLowerCase());
        console.log('UsernameService: Document reference:', usernameRef.path);
        
        const usernameDoc = await getDoc(usernameRef);
        console.log('UsernameService: Document exists:', usernameDoc.exists());
        
        if (usernameDoc.exists()) {
          const data = usernameDoc.data();
          console.log('UsernameService: Document data:', data);
          return data.uid;
        }
        
        console.log('UsernameService: Document not found');
        return null;
      } catch (error) {
        console.error('Get user by username error:', error);
        console.error('Error details:', error);
        return null;
      }
    }

    // Release username reservation when user is deleted
    static async releaseUsername(username: string): Promise<void> {
      try {
        const usernameRef = doc(db, 'usernames', username.toLowerCase());
        await deleteDoc(usernameRef);
      } catch (error) {
        console.error('Release username error:', error);
        throw error;
      }
    }
  }

