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
  onSnapshot,
  Timestamp,
  increment
} from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';

// Forum post types
export type ForumTag = "general" | "question" | "advice" | "event" | "policy";

export interface ForumComment {
  id: string;
  parentId: string | null;
  body: string;
  authorRole: User['role'];
  authorName: string;
  authorId: string;
  createdAt: Date;
  upvotes: number;
  upvotedBy: string[]; // Array of user IDs who upvoted
  hidden?: boolean;
  hiddenBy?: string; // ID of teacher/admin who hid it
}

export interface ForumPost {
  id: string;
  title: string;
  body: string;
  tag: ForumTag;
  authorRole: User['role'];
  authorName: string;
  authorId: string;
  createdAt: Date;
  isPinned: boolean;
  upvotes: number;
  upvotedBy: string[]; // Array of user IDs who upvoted
  commentCount: number;
}

export class ForumService {
  // Create new forum post
  static async createPost(post: Omit<ForumPost, 'id' | 'createdAt' | 'upvotes' | 'upvotedBy' | 'commentCount'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'forum_posts'), {
        ...post,
        createdAt: Timestamp.now(),
        upvotes: 0,
        upvotedBy: [],
        commentCount: 0
      });
      return docRef.id;
    } catch (error) {
      console.error('Create forum post error:', error);
      throw error;
    }
  }

  // Get all forum posts
  static async getPosts(): Promise<ForumPost[]> {
    try {
      const q = query(
        collection(db, 'forum_posts'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as ForumPost[];
    } catch (error) {
      console.error('Get forum posts error:', error);
      throw error;
    }
  }

  // Update forum post
  static async updatePost(id: string, updates: Partial<Omit<ForumPost, 'id' | 'createdAt' | 'upvotes' | 'upvotedBy' | 'commentCount'>>): Promise<void> {
    try {
      await updateDoc(doc(db, 'forum_posts', id), updates);
    } catch (error) {
      console.error('Update forum post error:', error);
      throw error;
    }
  }

  // Delete forum post with cascading deletes
  static async deletePost(id: string): Promise<void> {
    try {
      console.log(`Starting cascading delete for forum post: ${id}`);
      
      // 1. Delete all comments for this post
      const commentsQuery = query(collection(db, 'forum_comments'), where('postId', '==', id));
      const commentsSnapshot = await getDocs(commentsQuery);
      
      if (!commentsSnapshot.empty) {
        console.log(`Found ${commentsSnapshot.docs.length} comments to delete`);
        const deletePromises = commentsSnapshot.docs.map(commentDoc => 
          deleteDoc(doc(db, 'forum_comments', commentDoc.id))
        );
        await Promise.all(deletePromises);
        console.log(`Deleted ${commentsSnapshot.docs.length} comments`);
      } else {
        console.log('No comments found to delete');
      }

      // 2. Delete the post itself
      await deleteDoc(doc(db, 'forum_posts', id));
      console.log(`Forum post ${id} deleted successfully`);
      
    } catch (error) {
      console.error('Delete forum post error:', error);
      throw error;
    }
  }

  // Toggle pin status (teachers/admins only)
  static async togglePin(postId: string, isPinned: boolean): Promise<void> {
    try {
      await updateDoc(doc(db, 'forum_posts', postId), { isPinned });
    } catch (error) {
      console.error('Toggle pin error:', error);
      throw error;
    }
  }

  // Toggle upvote on post
  static async togglePostUpvote(postId: string, userId: string): Promise<void> {
    try {
      const postRef = doc(db, 'forum_posts', postId);
      const postDoc = await getDoc(postRef);
      
      if (postDoc.exists()) {
        const data = postDoc.data();
        const upvotedBy = data.upvotedBy || [];
        const hasUpvoted = upvotedBy.includes(userId);
        
        if (hasUpvoted) {
          // Remove upvote
          await updateDoc(postRef, {
            upvotedBy: upvotedBy.filter((id: string) => id !== userId),
            upvotes: increment(-1)
          });
        } else {
          // Add upvote
          await updateDoc(postRef, {
            upvotedBy: [...upvotedBy, userId],
            upvotes: increment(1)
          });
        }
      }
    } catch (error) {
      console.error('Toggle post upvote error:', error);
      throw error;
    }
  }

  // Add comment to post
  static async addComment(
    postId: string, 
    comment: Omit<ForumComment, 'id' | 'createdAt' | 'upvotes' | 'upvotedBy'>
  ): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, 'forum_comments'), {
        ...comment,
        postId,
        createdAt: Timestamp.now(),
        upvotes: 0,
        upvotedBy: []
      });

      // Increment comment count on post
      await updateDoc(doc(db, 'forum_posts', postId), {
        commentCount: increment(1)
      });

      return docRef.id;
    } catch (error) {
      console.error('Add forum comment error:', error);
      throw error;
    }
  }

  // Get comments for a post
  static async getPostComments(postId: string): Promise<ForumComment[]> {
    try {
      const q = query(
        collection(db, 'forum_comments'),
        where('postId', '==', postId)
      );
      
      const querySnapshot = await getDocs(q);
      const comments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as ForumComment[];
      
      // Sort by createdAt on the client side to avoid index requirement
      return comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    } catch (error) {
      console.error('Get forum comments error:', error);
      throw error;
    }
  }

  // Delete comment
  static async deleteComment(commentId: string, postId: string): Promise<void> {
    try {
      // Get the comment to check if it has children
      const commentRef = doc(db, 'forum_comments', commentId);
      
      // Find all child comments (recursive)
      const childCommentsQuery = query(
        collection(db, 'forum_comments'),
        where('postId', '==', postId),
        where('parentId', '==', commentId)
      );
      
      const childSnapshot = await getDocs(childCommentsQuery);
      
      // Delete all child comments recursively
      const deletePromises: Promise<void>[] = [];
      for (const childDoc of childSnapshot.docs) {
        deletePromises.push(this.deleteComment(childDoc.id, postId));
      }
      
      await Promise.all(deletePromises);
      
      // Delete the comment itself
      await deleteDoc(commentRef);
      
      // Decrement comment count on post
      await updateDoc(doc(db, 'forum_posts', postId), {
        commentCount: increment(-1)
      });
    } catch (error) {
      console.error('Delete forum comment error:', error);
      throw error;
    }
  }

  // Toggle upvote on comment
  static async toggleCommentUpvote(commentId: string, userId: string): Promise<void> {
    try {
      const commentRef = doc(db, 'forum_comments', commentId);
      const commentDoc = await getDoc(commentRef);
      
      if (commentDoc.exists()) {
        const data = commentDoc.data();
        const upvotedBy = data.upvotedBy || [];
        const hasUpvoted = upvotedBy.includes(userId);
        
        if (hasUpvoted) {
          // Remove upvote
          await updateDoc(commentRef, {
            upvotedBy: upvotedBy.filter((id: string) => id !== userId),
            upvotes: increment(-1)
          });
        } else {
          // Add upvote
          await updateDoc(commentRef, {
            upvotedBy: [...upvotedBy, userId],
            upvotes: increment(1)
          });
        }
      }
    } catch (error) {
      console.error('Toggle comment upvote error:', error);
      throw error;
    }
  }

  // Hide/unhide comment (teachers/admins only)
  static async toggleCommentHidden(commentId: string, userId: string, hidden: boolean): Promise<void> {
    try {
      const updates: any = { hidden };
      if (hidden) {
        updates.hiddenBy = userId;
      } else {
        updates.hiddenBy = null;
      }
      
      await updateDoc(doc(db, 'forum_comments', commentId), updates);
    } catch (error) {
      console.error('Toggle comment hidden error:', error);
      throw error;
    }
  }

  // Listen to real-time updates for posts
  static subscribeToposts(callback: (posts: ForumPost[]) => void) {
    const q = query(
      collection(db, 'forum_posts'),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const posts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as ForumPost[];
      
      callback(posts);
    });
  }

  // Listen to real-time updates for comments
  static subscribeToComments(postId: string, callback: (comments: ForumComment[]) => void) {
    const q = query(
      collection(db, 'forum_comments'),
      where('postId', '==', postId)
    );
    
    return onSnapshot(q, (querySnapshot) => {
      const comments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate()
      })) as ForumComment[];
      
      // Sort by createdAt on the client side to avoid index requirement
      const sortedComments = comments.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      callback(sortedComments);
    });
  }

  // Get posts with their comments
  static async getPostsWithComments(): Promise<(ForumPost & { comments: ForumComment[] })[]> {
    try {
      const posts = await this.getPosts();
      const postsWithComments = await Promise.all(
        posts.map(async (post) => {
          const comments = await this.getPostComments(post.id);
          return { ...post, comments };
        })
      );
      
      return postsWithComments;
    } catch (error) {
      console.error('Get posts with comments error:', error);
      throw error;
    }
  }
}
