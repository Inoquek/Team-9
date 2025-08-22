import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    getDocs,
    onSnapshot
  } from 'firebase/firestore';
  import { db } from '../firebase';
  import { Portfolio, CategoryProgress, Badge } from '../types';
  
  export class PortfolioService {
    // Get student portfolio
    static async getStudentPortfolio(studentId: string): Promise<Portfolio | null> {
      try {
        const portfolioDoc = await getDoc(doc(db, 'portfolios', studentId));
        if (portfolioDoc.exists()) {
          return portfolioDoc.data() as Portfolio;
        }
        return null;
      } catch (error) {
        console.error('Get portfolio error:', error);
        throw error;
      }
    }
  
    // Create or update portfolio
    static async updatePortfolio(portfolio: Partial<Portfolio> & { id: string }): Promise<void> {
      try {
        const portfolioRef = doc(db, 'portfolios', portfolio.id);
        const existingDoc = await getDoc(portfolioRef);
        
        if (existingDoc.exists()) {
          await updateDoc(portfolioRef, {
            ...portfolio,
            updatedAt: new Date()
          });
        } else {
          await setDoc(portfolioRef, {
            ...portfolio,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        }
      } catch (error) {
        console.error('Update portfolio error:', error);
        throw error;
      }
    }
  
    // Update category progress
    static async updateCategoryProgress(
      studentId: string, 
      category: keyof Portfolio['categories'], 
      progress: Partial<CategoryProgress>
    ): Promise<void> {
      try {
        const portfolioRef = doc(db, 'portfolios', studentId);
        await updateDoc(portfolioRef, {
          [`categories.${category}`]: {
            ...progress,
            lastActivity: new Date()
          },
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Update category progress error:', error);
        throw error;
      }
    }
  
    // Add points to portfolio
    static async addPoints(studentId: string, points: number, category?: keyof Portfolio['categories']): Promise<void> {
      try {
        const portfolioRef = doc(db, 'portfolios', studentId);
        
        if (category) {
          // Add points to specific category
          await updateDoc(portfolioRef, {
            [`categories.${category}.points`]: points,
            totalPoints: points,
            updatedAt: new Date()
          });
        } else {
          // Add points to total
          await updateDoc(portfolioRef, {
            totalPoints: points,
            updatedAt: new Date()
          });
        }
      } catch (error) {
        console.error('Add points error:', error);
        throw error;
      }
    }
  
    // Unlock badge
    static async unlockBadge(studentId: string, badge: Badge): Promise<void> {
      try {
        const portfolioRef = doc(db, 'portfolios', studentId);
        await updateDoc(portfolioRef, {
          badges: badge,
          updatedAt: new Date()
        });
      } catch (error) {
        console.error('Unlock badge error:', error);
        throw error;
      }
    }
  
    // Listen to portfolio updates
    static subscribeToPortfolio(studentId: string, callback: (portfolio: Portfolio | null) => void) {
      return onSnapshot(doc(db, 'portfolios', studentId), (doc) => {
        if (doc.exists()) {
          callback(doc.data() as Portfolio);
        } else {
          callback(null);
        }
      });
    }
  }


