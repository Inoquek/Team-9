import { 
    collection, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs,
    onSnapshot
  } from 'firebase/firestore';
  import { db } from '../firebase';
  import { LeaderboardEntry, Badge } from '../types';
  
  export class GamificationService {
    // Get leaderboard
    static async getLeaderboard(limitCount: number = 10): Promise<LeaderboardEntry[]> {
      try {
        const q = query(
          collection(db, 'leaderboard'),
          orderBy('totalPoints', 'desc'),
          limit(limitCount)
        );
        
        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map((doc, index) => ({
          id: doc.id,
          ...doc.data(),
          rank: index + 1
        })) as LeaderboardEntry[];
      } catch (error) {
        console.error('Get leaderboard error:', error);
        throw error;
      }
    }
  
    // Update family points
    static async updateFamilyPoints(familyId: string, points: number): Promise<void> {
      try {
        const leaderboardRef = doc(db, 'leaderboard', familyId);
        const existingDoc = await getDoc(leaderboardRef);
        
        if (existingDoc.exists()) {
          const currentData = existingDoc.data() as LeaderboardEntry;
          await updateDoc(leaderboardRef, {
            totalPoints: currentData.totalPoints + points,
            lastActivity: new Date()
          });
        } else {
          // Create new leaderboard entry
          await setDoc(leaderboardRef, {
            familyId,
            familyName: 'Family', // This should be updated with actual family name
            totalPoints: points,
            rank: 0,
            lastActivity: new Date(),
            badges: []
          });
        }
      } catch (error) {
        console.error('Update family points error:', error);
        throw error;
      }
    }
  
    // Get available badges
    static async getAvailableBadges(): Promise<Badge[]> {
      try {
        const badgesSnapshot = await getDocs(collection(db, 'badges'));
        return badgesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Badge[];
      } catch (error) {
        console.error('Get badges error:', error);
        throw error;
      }
    }
  
    // Check if badge should be unlocked
    static async checkBadgeUnlock(studentId: string, category: string, points: number): Promise<Badge | null> {
      try {
        const badgesSnapshot = await getDocs(
          query(
            collection(db, 'badges'),
            where('category', '==', category),
            where('pointsRequired', '<=', points)
          )
        );
        
        if (!badgesSnapshot.empty) {
          // Get the highest level badge that can be unlocked
          const badges = badgesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Badge[];
          
          const highestBadge = badges.reduce((prev, current) => 
            prev.pointsRequired > current.pointsRequired ? prev : current
          );
          
          return highestBadge;
        }
        
        return null;
      } catch (error) {
        console.error('Check badge unlock error:', error);
        throw error;
      }
    }
  
    // Listen to leaderboard updates
    static subscribeToLeaderboard(callback: (leaderboard: LeaderboardEntry[]) => void) {
      const q = query(
        collection(db, 'leaderboard'),
        orderBy('totalPoints', 'desc'),
        limit(10)
      );
      
      return onSnapshot(q, (querySnapshot) => {
        const leaderboard = querySnapshot.docs.map((doc, index) => ({
          id: doc.id,
          ...doc.data(),
          rank: index + 1
        })) as LeaderboardEntry[];
        callback(leaderboard);
      });
    }
  }


