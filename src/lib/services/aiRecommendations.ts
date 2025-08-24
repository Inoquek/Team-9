import { 
  collection, 
  doc, 
  addDoc, 
  getDocs, 
  getDoc,
  updateDoc,
  query, 
  where, 
  orderBy,
  limit,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

// Types for AI Recommendations
export interface ParentRecommendation {
  id?: string;
  parentId: string;
  studentId?: string;
  studentName?: string;
  classId?: string;
  title: string;
  content?: string;              // For backward compatibility
  contentEnglish?: string;       // New format
  contentChinese: string;
  category: 'study_habits' | 'assignment_help' | 'progress_encouragement' | 'parent_engagement' | 'time_management' | 'learning';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  isRead: boolean;
  actionTaken?: boolean;
}

export interface StudentContext {
  studentId: string;
  name: string;
  classId: string;
  parentId: string;
  recentGrades: number[];
  completionRate: number;
  studyTimeMinutes: number;
  upcomingDeadlines: {
    assignmentTitle: string;
    dueDate: Date;
    subject: string;
  }[];
  strugglingSubjects: string[];
  parentEngagementLevel: 'high' | 'medium' | 'low';
}

class AIRecommendationService {
  private readonly API_BASE_URL = 'https://api.deepseek.com';
  private readonly MODEL = 'deepseek-chat';
  private readonly MAX_TOKENS = 300;
  
  // Cache for recent recommendations to avoid duplicates
  private static cache = new Map<string, ParentRecommendation[]>();

  /**
   * Generate personalized recommendation for a parent
   */
  async generateRecommendation(context: StudentContext): Promise<ParentRecommendation> {
    try {
      // Check cache first
      const cacheKey = `${context.parentId}-${context.studentId}`;
      const recentRecommendations = AIRecommendationService.cache.get(cacheKey) || [];
      
      // Generate AI content
      const aiResponse = await this.callDeepSeekAPI(context, recentRecommendations);
      
      const recommendation: ParentRecommendation = {
        parentId: context.parentId,
        studentId: context.studentId,
        classId: context.classId,
        title: aiResponse.title,
        content: aiResponse.content,
        contentChinese: aiResponse.contentChinese,
        category: aiResponse.category,
        priority: aiResponse.priority,
        createdAt: new Date(),
        isRead: false
      };

      // Save to Firestore
      console.log('Debug: Saving recommendation to Firestore:', recommendation);
      const docRef = await addDoc(collection(db, 'parentRecommendations'), recommendation);
      recommendation.id = docRef.id;
      console.log('Debug: Recommendation saved with ID:', docRef.id);

      // Update cache
      recentRecommendations.push(recommendation);
      if (recentRecommendations.length > 5) {
        recentRecommendations.shift(); // Keep only 5 recent recommendations
      }
      AIRecommendationService.cache.set(cacheKey, recentRecommendations);

      return recommendation;
    } catch (error) {
      console.error('Error generating recommendation:', error);
      // Fallback to template-based recommendation
      return this.generateFallbackRecommendation(context);
    }
  }

  /**
   * Call DeepSeek API for AI-generated recommendations
   */
  private async callDeepSeekAPI(
    context: StudentContext, 
    recentRecommendations: ParentRecommendation[]
  ): Promise<{
    title: string;
    content: string;
    contentChinese: string;
    category: ParentRecommendation['category'];
    priority: ParentRecommendation['priority'];
  }> {
    const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error('DeepSeek API key not configured');
    }

    // Build context prompt
    const systemPrompt = `You are an AI assistant helping Chinese parents support their children's education. 
    Generate personalized recommendations that are culturally appropriate and practical.
    
    IMPORTANT: Provide response in this EXACT JSON format:
    {
      "title": "Brief title in English (max 50 chars)",
      "content": "Detailed recommendation in English (max 200 chars)",
      "contentChinese": "Same recommendation translated to Chinese (max 300 chars)",
      "category": "one of: study_habits, assignment_help, progress_encouragement, parent_engagement, time_management",
      "priority": "one of: low, medium, high"
    }`;

    const userPrompt = this.buildContextPrompt(context, recentRecommendations);

    const response = await fetch(`${this.API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: this.MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: this.MAX_TOKENS,
        temperature: 0.7,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`DeepSeek API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('No content received from DeepSeek API');
    }

    try {
      return JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      throw new Error('Invalid AI response format');
    }
  }

  /**
   * Build context prompt for AI
   */
  private buildContextPrompt(context: StudentContext, recentRecommendations: ParentRecommendation[]): string {
    const recentTopics = recentRecommendations.map(r => r.category).join(', ');
    
    return `Student: ${context.name}
Parent Engagement: ${context.parentEngagementLevel}
Recent Grades: ${context.recentGrades.join(', ')} (average: ${context.recentGrades.reduce((a, b) => a + b, 0) / context.recentGrades.length || 0})
Assignment Completion Rate: ${context.completionRate}%
Study Time This Week: ${Math.round(context.studyTimeMinutes / 60)}h ${context.studyTimeMinutes % 60}m
Struggling Subjects: ${context.strugglingSubjects.join(', ') || 'None identified'}
Upcoming Deadlines: ${context.upcomingDeadlines.length} assignments

Recent recommendation topics (avoid repeating): ${recentTopics}

Generate a helpful, actionable recommendation for this Chinese parent. Consider:
1. Cultural values (education importance, family support)
2. Practical actions they can take
3. Encouraging but realistic tone
4. Focus on 1-2 specific actionable items`;
  }

  /**
   * Fallback recommendation when AI fails
   */
  private generateFallbackRecommendation(context: StudentContext): ParentRecommendation {
    const templates = [
      {
        title: "Study Schedule Support",
        content: "Help your child create a daily study routine with breaks every 30 minutes.",
        contentChinese: "帮助您的孩子制定每日学习计划，每30分钟休息一次。",
        category: "study_habits" as const,
        priority: "medium" as const
      },
      {
        title: "Assignment Organization",
        content: "Use a calendar to track upcoming assignments and break them into smaller tasks.",
        contentChinese: "使用日历跟踪即将到来的作业，并将其分解为更小的任务。",
        category: "time_management" as const,
        priority: "high" as const
      },
      {
        title: "Positive Reinforcement",
        content: "Celebrate small improvements to build your child's confidence in learning.",
        contentChinese: "庆祝小进步，增强孩子学习的信心。",
        category: "progress_encouragement" as const,
        priority: "low" as const
      }
    ];

    const randomTemplate = templates[Math.floor(Math.random() * templates.length)];
    
    return {
      parentId: context.parentId,
      studentId: context.studentId,
      classId: context.classId,
      ...randomTemplate,
      createdAt: new Date(),
      isRead: false
    };
  }

  /**
   * Get student context for AI recommendation
   */
  async getStudentContext(studentId: string): Promise<StudentContext> {
    try {
      // Get student basic info
      const studentDoc = await getDoc(doc(db, 'students', studentId));
      if (!studentDoc.exists()) {
        throw new Error('Student not found');
      }
      
      const studentData = studentDoc.data() as any;
      
      // Get recent submissions for grades and completion rate
      const submissionsQuery = query(
        collection(db, 'submissions'),
        where('studentId', '==', studentId),
        orderBy('submittedAt', 'desc'),
        limit(10)
      );
      const submissionsSnapshot = await getDocs(submissionsQuery);
      const recentSubmissions = submissionsSnapshot.docs.map(doc => doc.data() as any);
      
      // Calculate metrics
      const recentGrades = recentSubmissions
        .map(s => s.points || s.feedback?.points)
        .filter(grade => typeof grade === 'number');
        
      const completionRate = recentSubmissions.length > 0 
        ? Math.round((recentSubmissions.filter(s => s.status !== 'missed').length / recentSubmissions.length) * 100)
        : 100;
        
      const totalStudyTime = recentSubmissions.reduce((sum, s) => sum + (s.completionTimeMinutes || 0), 0);
      
      // Get upcoming assignments
      const assignmentsQuery = query(
        collection(db, 'assignments'),
        where('classId', '==', studentData.classId),
        where('status', '==', 'active'),
        orderBy('dueDate', 'asc'),
        limit(5)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const upcomingDeadlines = assignmentsSnapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          assignmentTitle: data.title,
          dueDate: data.dueDate?.toDate() || new Date(),
          subject: data.subject || 'General'
        };
      });
      
      // Identify struggling subjects (grades below 70)
      const subjectGrades: Record<string, number[]> = {};
      recentSubmissions.forEach(sub => {
        const grade = sub.points || sub.feedback?.points;
        if (typeof grade === 'number' && sub.subject) {
          if (!subjectGrades[sub.subject]) subjectGrades[sub.subject] = [];
          subjectGrades[sub.subject].push(grade);
        }
      });
      
      const strugglingSubjects = Object.entries(subjectGrades)
        .filter(([_, grades]) => {
          const avg = grades.reduce((a, b) => a + b, 0) / grades.length;
          return avg < 70;
        })
        .map(([subject, _]) => subject);

      return {
        studentId,
        name: studentData.name || 'Student',
        classId: studentData.classId,
        parentId: studentData.parentId,
        recentGrades,
        completionRate,
        studyTimeMinutes: totalStudyTime,
        upcomingDeadlines,
        strugglingSubjects,
        parentEngagementLevel: this.calculateParentEngagement(studentData.parentId)
      };
      
    } catch (error) {
      console.error('Error getting student context:', error);
      throw error;
    }
  }

  /**
   * Calculate parent engagement level based on recent activity
   */
  private calculateParentEngagement(parentId: string): 'high' | 'medium' | 'low' {
    // This is a simplified calculation - you can enhance it based on:
    // - Recent logins
    // - Comments on assignments
    // - Submissions made
    // - Messages sent to teachers
    
    // For now, return medium as default
    return 'medium';
  }

  /**
   * Get recommendations for a parent
   */
  async getParentRecommendations(parentId: string, limitCount: number = 10): Promise<ParentRecommendation[]> {
    try {
      // Use simple query without orderBy to avoid index requirement
      const q = query(
        collection(db, 'parentRecommendations'),
        where('parentId', '==', parentId),
        limit(limitCount)
      );
      
      console.log('Debug: Executing simple query for parentId:', parentId);
      const querySnapshot = await getDocs(q);
      console.log('Debug: Found', querySnapshot.docs.length, 'documents');
      
      let recommendations = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      })) as ParentRecommendation[];

      // Sort in memory by createdAt (most recent first)
      recommendations.sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt : new Date(0);
        const bTime = b.createdAt instanceof Date ? b.createdAt : new Date(0);
        return bTime.getTime() - aTime.getTime();
      });

      console.log('Debug: Sorted recommendations:', recommendations);
      return recommendations;
      
    } catch (error) {
      console.error('Error getting parent recommendations:', error);
      return [];
    }
  }

  /**
   * Mark recommendation as read
   */
  async markRecommendationAsRead(recommendationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'parentRecommendations', recommendationId), {
        isRead: true,
        readAt: new Date()
      });
    } catch (error) {
      console.error('Error marking recommendation as read:', error);
      throw error;
    }
  }

  /**
   * Generate recommendations for all students in a class (batch processing)
   */
  async generateBatchRecommendations(classId: string): Promise<void> {
    try {
      // Get all students in the class
      const studentsQuery = query(
        collection(db, 'students'),
        where('classId', '==', classId)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      
      // Process in small batches to avoid rate limits
      const batchSize = 5;
      const students = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      for (let i = 0; i < students.length; i += batchSize) {
        const batch = students.slice(i, i + batchSize);
        
        const promises = batch.map(async (student) => {
          try {
            const context = await this.getStudentContext(student.id);
            await this.generateRecommendation(context);
            console.log(`Generated recommendation for student: ${student.id}`);
          } catch (error) {
            console.error(`Failed to generate recommendation for student ${student.id}:`, error);
          }
        });
        
        await Promise.all(promises);
        
        // Add delay between batches to respect rate limits
        if (i + batchSize < students.length) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // 2-second delay
        }
      }
      
      console.log(`Batch recommendations generated for class: ${classId}`);
    } catch (error) {
      console.error('Error generating batch recommendations:', error);
      throw error;
    }
  }
}

export default new AIRecommendationService();
