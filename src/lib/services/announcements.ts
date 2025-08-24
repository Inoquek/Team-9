import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query, 
  where, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase';
import { Announcement, Comment, AnnouncementWithComments } from '../types';

export class AnnouncementService {
  // Create new announcement
  static async createAnnouncement(announcement: Omit<Announcement, 'id' | 'createdAt' | 'readBy'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'announcements'), {
        ...announcement,
        createdAt: new Date(),
        readBy: []
      });
      return docRef.id;
    } catch (error) {
      console.error('Create announcement error:', error);
      throw error;
    }
  }

  // Get announcements for a class (simplified - no composite index required)
  static async getClassAnnouncements(classId: string): Promise<Announcement[]> {
    try {
      const q = query(
        collection(db, 'announcements'),
        where('classId', '==', classId)
      );
      
      const querySnapshot = await getDocs(q);
      let announcements = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      
      // Sort in memory (avoids composite index requirement)
      announcements = announcements.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      return announcements;
    } catch (error) {
      console.error('Get announcements error:', error);
      throw error;
    }
  }

  // Get announcements for a teacher (all their classes) - simplified
  static async getTeacherAnnouncements(teacherId: string): Promise<Announcement[]> {
    try {
      const q = query(
        collection(db, 'announcements'),
        where('teacherId', '==', teacherId)
      );
      
      const querySnapshot = await getDocs(q);
      let announcements = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      
      // Sort in memory
      announcements = announcements.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      return announcements;
    } catch (error) {
      console.error('Get teacher announcements error:', error);
      throw error;
    }
  }

  // Update announcement
  static async updateAnnouncement(id: string, updates: Partial<Announcement>): Promise<void> {
    try {
      await updateDoc(doc(db, 'announcements', id), updates);
    } catch (error) {
      console.error('Update announcement error:', error);
      throw error;
    }
  }

  // Delete announcement with cascading deletes
  static async deleteAnnouncement(id: string): Promise<void> {
    try {
      console.log(`Starting cascading delete for announcement: ${id}`);
      
      // 1. Delete all comments for this announcement
      const commentsQuery = query(
        collection(db, 'announcements', id, 'comments')
      );
      const commentsSnapshot = await getDocs(commentsQuery);
      
      if (!commentsSnapshot.empty) {
        console.log(`Found ${commentsSnapshot.docs.length} comments to delete`);
        const deleteCommentPromises = commentsSnapshot.docs.map(doc => 
          deleteDoc(doc.ref)
        );
        await Promise.all(deleteCommentPromises);
        console.log(`Deleted ${commentsSnapshot.docs.length} comments`);
      }
      
      // 2. Delete the announcement itself
      await deleteDoc(doc(db, 'announcements', id));
      console.log(`Announcement ${id} deleted successfully`);
      
    } catch (error) {
      console.error('Delete announcement error:', error);
      throw error;
    }
  }

  // Mark announcement as read
  static async markAsRead(announcementId: string, userId: string): Promise<void> {
    try {
      const announcementRef = doc(db, 'announcements', announcementId);
      const announcementDoc = await getDoc(announcementRef);
      
      if (announcementDoc.exists()) {
        const data = announcementDoc.data() as Announcement;
        const readBy = data.readBy || [];
        
        if (!readBy.includes(userId)) {
          readBy.push(userId);
          await updateDoc(announcementRef, { readBy });
        }
      }
    } catch (error) {
      console.error('Mark as read error:', error);
      throw error;
    }
  }

  // Listen to real-time updates for announcements (simplified)
  static subscribeToAnnouncements(classId: string, callback: (announcements: Announcement[]) => void) {
    const q = query(
      collection(db, 'announcements'),
      where('classId', '==', classId)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      let announcements = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      
      // Sort in memory
      announcements = announcements.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      callback(announcements);
    });
  }

    // Get announcement statistics for a class
  static async getAnnouncementStats(classId: string): Promise<{
    total: number;
    thisWeek: number;
    readRate: number;
  }> {
    try {
      const announcements = await this.getClassAnnouncements(classId);
      const total = announcements.length;

      // Calculate this week's announcements
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const thisWeek = announcements.filter(a =>
        a.createdAt && new Date(a.createdAt) > oneWeekAgo
      ).length;

      // Calculate read rate (average percentage of users who read announcements)
      const totalReads = announcements.reduce((sum, a) => sum + (a.readBy?.length || 0), 0);
      const totalPossibleReads = announcements.length * 20; // Assuming average 20 parents per class
      const readRate = totalPossibleReads > 0 ? Math.round((totalReads / totalPossibleReads) * 100) : 0;

      return { total, thisWeek, readRate };
    } catch (error) {
      console.error('Get announcement stats error:', error);
      return { total: 0, thisWeek: 0, readRate: 0 };
    }
  }

  // Comment functionality
  static async addComment(announcementId: string, comment: Omit<Comment, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'announcements', announcementId, 'comments'), {
        ...comment,
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Add comment error:', error);
      throw error;
    }
  }

  static async getAnnouncementComments(announcementId: string): Promise<Comment[]> {
    try {
      const q = query(
        collection(db, 'announcements', announcementId, 'comments'),
        orderBy('createdAt', 'asc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
    } catch (error) {
      console.error('Get comments error:', error);
      throw error;
    }
  }

  static async updateComment(announcementId: string, commentId: string, updates: Partial<Comment>): Promise<void> {
    try {
      await updateDoc(doc(db, 'announcements', announcementId, 'comments', commentId), {
        ...updates,
        updatedAt: new Date(),
        isEdited: true
      });
    } catch (error) {
      console.error('Update comment error:', error);
      throw error;
    }
  }

  static async deleteComment(announcementId: string, commentId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'announcements', announcementId, 'comments', commentId));
    } catch (error) {
      console.error('Delete comment error:', error);
      throw error;
    }
  }

  // Get announcements with comments
  static async getClassAnnouncementsWithComments(classId: string): Promise<AnnouncementWithComments[]> {
    try {
      const announcements = await this.getClassAnnouncements(classId);
      const announcementsWithComments = await Promise.all(
        announcements.map(async (announcement) => {
          try {
            const comments = await this.getAnnouncementComments(announcement.id);
            return {
              ...announcement,
              comments,
              commentCount: comments.length
            };
          } catch (error) {
            console.error(`Error loading comments for announcement ${announcement.id}:`, error);
            return {
              ...announcement,
              comments: [],
              commentCount: 0
            };
          }
        })
      );
      
      return announcementsWithComments;
    } catch (error) {
      console.error('Get announcements with comments error:', error);
      throw error;
    }
  }
}
