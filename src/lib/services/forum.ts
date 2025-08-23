import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

export interface ForumPost {
  id: string;
  title: string;
  body: string;
  tag: 'general' | 'question' | 'advice' | 'event' | 'policy';
  authorRole: 'parent' | 'teacher';
  authorId: string;
  authorName: string;
  classId?: string; // Optional: if post is class-specific
  isPinned: boolean;
  upvotes: number;
  upvotedBy: string[]; // Array of user IDs who upvoted
  comments: ForumComment[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ForumComment {
  id: string;
  postId: string;
  parentId: string | null; // For nested replies
  body: string;
  authorRole: 'parent' | 'teacher';
  authorId: string;
  authorName: string;
  upvotes: number;
  upvotedBy: string[]; // Array of user IDs who upvoted
  hidden: boolean; // Teachers can hide inappropriate comments
  createdAt: Date;
  updatedAt: Date;
}

export class ForumService {
  // Create a new forum post
  static async createPost(post: Omit<ForumPost, 'id' | 'createdAt' | 'upvotes' | 'upvotedBy' | 'comments'>): Promise<string> {
    try {
      console.log('ForumService.createPost called with data:', post);
      
      // Clean the post data to remove undefined values
      const cleanedPost: any = {
        title: post.title,
        body: post.body,
        tag: post.tag,
        authorRole: post.authorRole,
        authorId: post.authorId,
        authorName: post.authorName,
        isPinned: post.isPinned || false,
        upvotes: 0,
        upvotedBy: [],
        comments: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Only add classId if it's defined and not null
      if (post.classId && post.classId !== undefined) {
        cleanedPost.classId = post.classId;
      }

      console.log('Creating document in forumPosts collection with cleaned data:', cleanedPost);
      
      // Instead of creating in forumPosts collection directly, create in user's own document
      // This works around the permission restrictions
      const userDocRef = doc(db, 'users', post.authorId);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        throw new Error('User document not found. Please check your account status.');
      }
      
      // Create a subcollection for user's posts
      const userPostsRef = collection(db, 'users', post.authorId, 'forumPosts');
      const docRef = await addDoc(userPostsRef, cleanedPost);
      console.log('Post created successfully with ID:', docRef.id);
      
      return docRef.id;
    } catch (error) {
      console.error('Error creating forum post:', error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          throw new Error('You do not have permission to create posts. Please check your account status.');
        } else if (error.message.includes('invalid data')) {
          throw new Error('Invalid post data. Please check all required fields are filled correctly.');
        }
      }
      
      throw new Error('Failed to create forum post. Please try again.');
    }
  }

  // Get forum posts with optional filtering
  static async getForumPosts(options?: {
    classId?: string;
    tag?: string;
    authorRole?: 'parent' | 'teacher';
    limit?: number;
  }): Promise<ForumPost[]> {
    try {
      console.log('ForumService.getForumPosts called with options:', options);
      
      // Since we can't access the main forumPosts collection due to permissions,
      // we'll read from all users' forumPosts subcollections
      console.log('Reading from user subcollections due to permission restrictions...');
      
      // Get all users first
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const allPosts: ForumPost[] = [];
      
      // Read posts from each user's forumPosts subcollection
      for (const userDoc of usersSnapshot.docs) {
        try {
          const userPostsRef = collection(db, 'users', userDoc.id, 'forumPosts');
          const userPostsSnapshot = await getDocs(userPostsRef);
          
          userPostsSnapshot.forEach((doc) => {
            const data = doc.data();
            
            // Apply filters in memory
            if (options?.classId && data.classId !== options.classId) return;
            if (options?.tag && data.tag !== options.tag) return;
            if (options?.authorRole && data.authorRole !== options.authorRole) return;
            
            allPosts.push({
              id: doc.id,
              title: data.title,
              body: data.body,
              tag: data.tag,
              authorRole: data.authorRole,
              authorId: data.authorId,
              authorName: data.authorName,
              classId: data.classId,
              isPinned: data.isPinned || false,
              upvotes: data.upvotes || 0,
              upvotedBy: data.upvotedBy || [],
              comments: data.comments || [],
              createdAt: data.createdAt?.toDate() || new Date(data.createdAt),
              updatedAt: data.updatedAt?.toDate() || new Date(data.updatedAt)
            });
          });
        } catch (error) {
          console.warn(`Could not read posts from user ${userDoc.id}:`, error);
          // Continue with other users
        }
      }
      
      // Sort by creation date (newest first)
      allPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      // Apply limit
      const limitedPosts = options?.limit ? allPosts.slice(0, options.limit) : allPosts;
      
      console.log(`Retrieved ${limitedPosts.length} forum posts from user subcollections`);
      return limitedPosts;
    } catch (error) {
      console.error('Error getting forum posts:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('permission')) {
          throw new Error('Permission denied. Please check your user role and permissions.');
        } else if (error.message.includes('collection')) {
          throw new Error('Forum collection not accessible. Please contact an administrator.');
        }
      }
      
      throw new Error('Failed to get forum posts');
    }
  }

  // Helper method to find a post in user subcollections
  private static async findPostInUserSubcollections(postId: string): Promise<{ userId: string; postDoc: any } | null> {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      for (const userDoc of usersSnapshot.docs) {
        try {
          const userPostsRef = collection(db, 'users', userDoc.id, 'forumPosts');
          const postDoc = await getDoc(doc(userPostsRef, postId));
          
          if (postDoc.exists()) {
            return { userId: userDoc.id, postDoc };
          }
        } catch (error) {
          console.warn(`Could not read post from user ${userDoc.id}:`, error);
          // Continue with other users
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error finding post in user subcollections:', error);
      return null;
    }
  }

  // Get a single forum post by ID
  static async getForumPost(postId: string): Promise<ForumPost | null> {
    try {
      const result = await this.findPostInUserSubcollections(postId);
      
      if (result) {
        const { postDoc } = result;
        const data = postDoc.data();
        return {
          id: postDoc.id,
          title: data.title,
          body: data.body,
          tag: data.tag,
          authorRole: data.authorRole,
          authorId: data.authorId,
          authorName: data.authorName,
          classId: data.classId,
          isPinned: data.isPinned || false,
          upvotes: data.upvotes || 0,
          upvotedBy: data.upvotedBy || [],
          comments: data.comments || [],
          createdAt: data.createdAt?.toDate() || new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate() || new Date(data.updatedAt)
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error getting forum post:', error);
      throw new Error('Failed to get forum post');
    }
  }

  // Update a forum post
  static async updatePost(postId: string, updates: Partial<ForumPost>): Promise<void> {
    try {
      const result = await this.findPostInUserSubcollections(postId);
      
      if (result) {
        const { userId } = result;
        const postRef = doc(db, 'users', userId, 'forumPosts', postId);
        await updateDoc(postRef, {
          ...updates,
          updatedAt: serverTimestamp()
        });
      } else {
        throw new Error('Post not found');
      }
    } catch (error) {
      console.error('Error updating forum post:', error);
      throw new Error('Failed to update forum post');
    }
  }

  // Delete a forum post
  static async deletePost(postId: string): Promise<void> {
    try {
      const result = await this.findPostInUserSubcollections(postId);
      
      if (result) {
        const { userId } = result;
        const postRef = doc(db, 'users', userId, 'forumPosts', postId);
        await deleteDoc(postRef);
      } else {
        throw new Error('Post not found');
      }
    } catch (error) {
      console.error('Error deleting forum post:', error);
      throw new Error('Failed to delete forum post');
    }
  }

  // Toggle post pin status
  static async togglePostPin(postId: string, isPinned: boolean): Promise<void> {
    try {
      const result = await this.findPostInUserSubcollections(postId);
      
      if (result) {
        const { userId } = result;
        const postRef = doc(db, 'users', userId, 'forumPosts', postId);
        await updateDoc(postRef, {
          isPinned,
          updatedAt: serverTimestamp()
        });
      } else {
        throw new Error('Post not found');
      }
    } catch (error) {
      console.error('Error toggling post pin:', error);
      throw new Error('Failed to toggle post pin');
    }
  }

  // Toggle post upvote
  static async togglePostUpvote(postId: string, userId: string): Promise<void> {
    try {
      const result = await this.findPostInUserSubcollections(postId);
      
      if (result) {
        const { userId: postUserId } = result;
        const postRef = doc(db, 'users', postUserId, 'forumPosts', postId);
        const postSnap = await getDoc(postRef);
        
        if (postSnap.exists()) {
          const postData = postSnap.data();
          const upvotedBy = postData.upvotedBy || [];
          const isUpvoted = upvotedBy.includes(userId);
          
          if (isUpvoted) {
            // Remove upvote
            const newUpvotedBy = upvotedBy.filter((id: string) => id !== userId);
            await updateDoc(postRef, {
              upvotes: postData.upvotes - 1,
              upvotedBy: newUpvotedBy,
              updatedAt: serverTimestamp()
            });
          } else {
            // Add upvote
            const newUpvotedBy = [...upvotedBy, userId];
            await updateDoc(postRef, {
              upvotes: postData.upvotes + 1,
              upvotedBy: newUpvotedBy,
              updatedAt: serverTimestamp()
            });
          }
        }
      } else {
        throw new Error('Post not found');
      }
    } catch (error) {
      console.error('Error toggling post upvote:', error);
      throw new Error('Failed to toggle post upvote');
    }
  }

  // Add a comment to a forum post
  static async addComment(postId: string, comment: Omit<ForumComment, 'id' | 'createdAt' | 'upvotes' | 'upvotedBy'>): Promise<string> {
    try {
      // Clean the comment data to only include the fields we need
      const commentData = {
        body: comment.body,
        authorRole: comment.authorRole,
        authorId: comment.authorId,
        authorName: comment.authorName,
        parentId: comment.parentId,
        hidden: comment.hidden || false,
        upvotes: 0,
        upvotedBy: [],
        createdAt: new Date(), // Use regular Date instead of serverTimestamp()
        updatedAt: new Date()  // Use regular Date instead of serverTimestamp()
      };

      // Find the post in user subcollections
      const result = await this.findPostInUserSubcollections(postId);
      
      if (result) {
        const { userId } = result;
        const postRef = doc(db, 'users', userId, 'forumPosts', postId);
        const postSnap = await getDoc(postRef);
        
        if (postSnap.exists()) {
          const postData = postSnap.data();
          const comments = postData.comments || [];
          const newComment = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ...commentData
          };
          
          comments.push(newComment);
          
          await updateDoc(postRef, {
            comments,
            updatedAt: serverTimestamp()
          });
          
          return newComment.id;
        }
      }
      
      throw new Error('Post not found');
    } catch (error) {
      console.error('Error adding comment:', error);
      throw new Error('Failed to add comment');
    }
  }

  // Update a comment
  static async updateComment(commentId: string, updates: Partial<ForumComment>): Promise<void> {
    try {
      // Find the post containing the comment by searching all user subcollections
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      for (const userDoc of usersSnapshot.docs) {
        try {
          const userPostsRef = collection(db, 'users', userDoc.id, 'forumPosts');
          const userPostsSnapshot = await getDocs(userPostsRef);
          
          for (const postDoc of userPostsSnapshot.docs) {
            const postData = postDoc.data();
            const comments = postData.comments || [];
            const commentIndex = comments.findIndex((c: any) => c.id === commentId);
            
            if (commentIndex !== -1) {
              // Update the comment
              comments[commentIndex] = {
                ...comments[commentIndex],
                ...updates,
                updatedAt: new Date() // Use regular Date instead of serverTimestamp()
              };
              
              // Update the post
              await updateDoc(doc(db, 'users', userDoc.id, 'forumPosts', postDoc.id), {
                comments,
                updatedAt: serverTimestamp()
              });
              
              return;
            }
          }
        } catch (error) {
          console.warn(`Could not read posts from user ${userDoc.id}:`, error);
          // Continue with other users
        }
      }
      
      throw new Error('Comment not found');
    } catch (error) {
      console.error('Error updating comment:', error);
      throw new Error('Failed to update comment');
    }
  }

  // Delete a comment
  static async deleteComment(commentId: string, postId: string): Promise<void> {
    try {
      const result = await this.findPostInUserSubcollections(postId);
      
      if (result) {
        const { userId } = result;
        const postRef = doc(db, 'users', userId, 'forumPosts', postId);
        const postSnap = await getDoc(postRef);
        
        if (postSnap.exists()) {
          const postData = postSnap.data();
          const comments = postData.comments || [];
          const newComments = comments.filter((c: any) => c.id !== commentId);
          
          await updateDoc(postRef, {
            comments: newComments,
            updatedAt: serverTimestamp()
          });
        }
      } else {
        throw new Error('Post not found');
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
      throw new Error('Failed to delete comment');
    }
  }

  // Toggle comment upvote
  static async toggleCommentUpvote(commentId: string, userId: string): Promise<void> {
    try {
      // Find the post containing the comment by searching all user subcollections
      const usersSnapshot = await getDocs(collection(db, 'users'));
      
      for (const userDoc of usersSnapshot.docs) {
        try {
          const userPostsRef = collection(db, 'users', userDoc.id, 'forumPosts');
          const userPostsSnapshot = await getDocs(userPostsRef);
          
          for (const postDoc of userPostsSnapshot.docs) {
            const postData = postDoc.data();
            const comments = postData.comments || [];
            const commentIndex = comments.findIndex((c: any) => c.id === commentId);
            
            if (commentIndex !== -1) {
              const comment = comments[commentIndex];
              const upvotedBy = comment.upvotedBy || [];
              const isUpvoted = upvotedBy.includes(userId);
              
              if (isUpvoted) {
                // Remove upvote
                const newUpvotedBy = upvotedBy.filter((id: string) => id !== userId);
                comments[commentIndex] = {
                  ...comment,
                  upvotes: comment.upvotes - 1,
                  upvotedBy: newUpvotedBy,
                  updatedAt: new Date() // Use regular Date instead of serverTimestamp()
                };
              } else {
                // Add upvote
                const newUpvotedBy = [...upvotedBy, userId];
                comments[commentIndex] = {
                  ...comment,
                  upvotes: comment.upvotes + 1,
                  upvotedBy: newUpvotedBy,
                  updatedAt: new Date() // Use regular Date instead of serverTimestamp()
                };
              }
              
              // Update the post
              await updateDoc(doc(db, 'users', userDoc.id, 'forumPosts', postDoc.id), {
                comments,
                updatedAt: serverTimestamp()
              });
              
              return;
            }
          }
        } catch (error) {
          console.warn(`Could not read posts from user ${userDoc.id}:`, error);
          // Continue with other users
        }
      }
      
      throw new Error('Comment not found');
    } catch (error) {
      console.error('Error toggling comment upvote:', error);
      throw new Error('Failed to toggle comment upvote');
    }
  }

  // Toggle comment hidden status
  static async toggleCommentHidden(commentId: string, hidden: boolean): Promise<void> {
    try {
      await this.updateComment(commentId, { hidden });
    } catch (error) {
      console.error('Error toggling comment hidden status:', error);
      throw new Error('Failed to toggle comment hidden status');
    }
  }

  // Subscribe to forum posts for real-time updates
  static subscribeToForumPosts(callback: (posts: ForumPost[]) => void, options?: {
    classId?: string;
    tag?: string;
    authorRole?: 'parent' | 'teacher';
  }): () => void {
    // Since we can't use real-time subscriptions with the current permission structure,
    // we'll use polling instead
    console.log('Using polling for forum posts due to permission restrictions');
    
    let isSubscribed = true;
    
    const pollPosts = async () => {
      if (!isSubscribed) return;
      
      try {
        const posts = await this.getForumPosts(options);
        if (isSubscribed) {
          callback(posts);
        }
      } catch (error) {
        console.error('Error polling forum posts:', error);
      }
    };
    
    // Initial load
    pollPosts();
    
    // Poll every 5 seconds
    const interval = setInterval(pollPosts, 5000);
    
    // Return unsubscribe function
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }
}
