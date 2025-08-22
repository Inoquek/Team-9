import { 
    ref, 
    uploadBytes, 
    getDownloadURL, 
    deleteObject,
    listAll
  } from 'firebase/storage';
import { storage } from '../firebase';
import { auth } from '../firebase';
  
  export class StorageService {
      // Upload file to Firebase Storage
  static async uploadFile(
    file: File, 
    path: string, 
    metadata?: { contentType?: string; customMetadata?: Record<string, string> }
  ): Promise<string> {
    try {
      // Check if user is authenticated
      if (!auth.currentUser) {
        throw new Error('User must be authenticated to upload files');
      }

      const storageRef = ref(storage, path);
      
      // Add custom metadata with user info
      const customMetadata = {
        ...metadata?.customMetadata,
        uploadedBy: auth.currentUser.uid,
        uploadedAt: new Date().toISOString(),
        originalName: file.name
      };

      const snapshot = await uploadBytes(storageRef, file, {
        ...metadata,
        customMetadata
      });
      
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    } catch (error) {
      console.error('Upload file error:', error);
      throw error;
    }
  }
  
    // Upload multiple files
    static async uploadMultipleFiles(
      files: File[], 
      basePath: string,
      metadata?: { contentType?: string; customMetadata?: Record<string, string> }
    ): Promise<string[]> {
      try {
        const uploadPromises = files.map((file, index) => {
          const fileName = `${Date.now()}_${index}_${file.name}`;
          const filePath = `${basePath}/${fileName}`;
          return this.uploadFile(file, filePath, metadata);
        });
        
        return await Promise.all(uploadPromises);
      } catch (error) {
        console.error('Upload multiple files error:', error);
        throw error;
      }
    }
  
    // Delete file from Firebase Storage
    static async deleteFile(path: string): Promise<void> {
      try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
      } catch (error) {
        console.error('Delete file error:', error);
        throw error;
      }
    }
  
    // Get file download URL
    static async getFileURL(path: string): Promise<string> {
      try {
        const storageRef = ref(storage, path);
        return await getDownloadURL(storageRef);
      } catch (error) {
        console.error('Get file URL error:', error);
        throw error;
      }
    }
  
    // List files in a directory
    static async listFiles(path: string): Promise<string[]> {
      try {
        const storageRef = ref(storage, path);
        const result = await listAll(storageRef);
        return result.items.map(item => item.fullPath);
      } catch (error) {
        console.error('List files error:', error);
        throw error;
      }
    }
  }


