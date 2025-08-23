import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDoc, 
  getDocs,
  query, 
  where, 
  orderBy,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { ClassSummary, GardenStudentData, Student, Assignment } from '../types';
import { StudentService } from './students';
import { AssignmentService } from './assignments';

export class GardenService {
  // Create or update class summary
  static async updateClassSummary(classId: string): Promise<void> {
    try {
      // Get all students in the class
      const students = await StudentService.getStudentsByClass(classId);
      
      // Get all active assignments for the class
      const assignments = await AssignmentService.getClassAssignments(classId);
      const activeAssignments = assignments.filter(a => a.status === 'active');
      
      // Calculate completion data for each student
      const studentData: GardenStudentData[] = [];
      let totalCompleted = 0;
      let totalStudyTime = 0;
      let newSubmissions = 0;
      
      for (const student of students) {
        const { total, completed } = await this.getStudentAssignmentProgress(student.id, classId);
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        studentData.push({
          id: student.id,
          name: student.name,
          completionRate,
          stage: this.getStageFromPercentage(completionRate),
          totalAssignments: total,
          completedAssignments: completed,
          lastActivity: new Date(), // TODO: Get actual last activity
        });
        
        totalCompleted += completed;
        
        // TODO: Get actual study time and submission counts
        if (completed > 0) newSubmissions += 1;
      }
      
      // Calculate performance distribution
      const performanceDistribution = {
        blooming: studentData.filter(s => s.stage === 'blooming').length,
        sprout: studentData.filter(s => s.stage === 'sprout').length,
        seedling: studentData.filter(s => s.stage === 'seedling').length,
        seed: studentData.filter(s => s.stage === 'seed').length,
      };
      
      // Create class summary
      const classSummary: Omit<ClassSummary, 'id'> = {
        classId,
        className: '', // TODO: Get from class document
        teacherId: '', // TODO: Get from class document
        lastUpdated: new Date(),
        totalStudents: students.length,
        averageCompletionRate: students.length > 0 ? Math.round(totalCompleted / (students.length * activeAssignments.length) * 100) : 0,
        totalAssignments: activeAssignments.length,
        completedAssignments: totalCompleted,
        performanceDistribution,
        recentActivity: {
          newSubmissions,
          completedAssignments: totalCompleted,
          averageStudyTime: students.length > 0 ? Math.round(totalStudyTime / students.length) : 0,
        },
      };
      
      // Check if summary already exists
      const existingSummary = await this.getClassSummary(classId);
      
      if (existingSummary) {
        // Update existing summary
        await updateDoc(doc(db, 'classSummaries', classId), classSummary);
      } else {
        // Create new summary
        await addDoc(collection(db, 'classSummaries'), {
          ...classSummary,
          id: classId, // Use classId as document ID for easy lookup
        });
      }
    } catch (error) {
      console.error('Error updating class summary:', error);
      throw error;
    }
  }
  
  // Get class summary
  static async getClassSummary(classId: string): Promise<ClassSummary | null> {
    try {
      const docRef = doc(db, 'classSummaries', classId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as ClassSummary;
      }
      return null;
    } catch (error) {
      console.error('Error getting class summary:', error);
      return null;
    }
  }
  
  // Get garden data for parents (anonymized student data)
  static async getGardenDataForParent(parentId: string): Promise<{
    classSummaries: ClassSummary[];
    ownChildrenData: GardenStudentData[];
  }> {
    try {
      console.log('Getting garden data for parent:', parentId);
      
      // Get parent's children
      const children = await StudentService.getStudentsByParent(parentId);
      console.log('Found children:', children);
      
      if (children.length === 0) {
        console.log('No children found for parent');
        return { classSummaries: [], ownChildrenData: [] };
      }
      
      const classIds = Array.from(new Set(children.map(c => c.classId).filter(Boolean)));
      console.log('Class IDs found:', classIds);
      
      // Get class summaries (these might not exist yet)
      const classSummaries: ClassSummary[] = [];
      for (const classId of classIds) {
        try {
          let summary = await this.getClassSummary(classId);
          
          // If no summary exists, create a basic one
          if (!summary) {
            console.log('Creating initial class summary for:', classId);
            await this.createInitialClassSummary(classId);
            summary = await this.getClassSummary(classId);
          }
          
          if (summary) {
            classSummaries.push(summary);
            console.log('Found class summary for:', classId);
          }
        } catch (error) {
          console.warn('Error getting/creating class summary for', classId, ':', error);
        }
      }
      
      // Get own children's data (with names) - this should always work
      const ownChildrenData: GardenStudentData[] = [];
      for (const child of children) {
        try {
          const { total, completed } = await this.getStudentAssignmentProgress(child.id, child.classId);
          const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
          
          ownChildrenData.push({
            id: child.id,
            name: child.name,
            completionRate,
            stage: this.getStageFromPercentage(completionRate),
            totalAssignments: total,
            completedAssignments: completed,
            lastActivity: new Date(),
            isOwnChild: true,
          });
          
          console.log('Added child data:', child.name, 'completion:', completionRate + '%');
        } catch (error) {
          console.error('Error getting data for child', child.id, ':', error);
          // Add child with minimal data if there's an error
          ownChildrenData.push({
            id: child.id,
            name: child.name,
            completionRate: 0,
            stage: 'seed',
            totalAssignments: 0,
            completedAssignments: 0,
            lastActivity: new Date(),
            isOwnChild: true,
          });
        }
      }
      
      console.log('Final result:', { classSummaries: classSummaries.length, ownChildrenData: ownChildrenData.length });
      return { classSummaries, ownChildrenData };
    } catch (error) {
      console.error('Error getting garden data for parent:', error);
      // Return empty data instead of throwing
      return { classSummaries: [], ownChildrenData: [] };
    }
  }
  
  // Create initial class summary when none exists
  private static async createInitialClassSummary(classId: string): Promise<void> {
    try {
      // Get basic class info
      const students = await StudentService.getStudentsByClass(classId);
      const assignments = await AssignmentService.getClassAssignments(classId);
      const activeAssignments = assignments.filter(a => a.status === 'active');
      
      // Create basic summary
      const initialSummary: Omit<ClassSummary, 'id'> = {
        classId,
        className: `Class ${classId.slice(-4)}`, // Use last 4 chars of classId as name
        teacherId: '', // Will be filled when teacher accesses
        lastUpdated: new Date(),
        totalStudents: students.length,
        averageCompletionRate: 0, // No assignments completed yet
        totalAssignments: activeAssignments.length,
        completedAssignments: 0,
        performanceDistribution: {
          blooming: 0,
          sprout: 0,
          seedling: 0,
          seed: students.length, // All students start as seeds
        },
        recentActivity: {
          newSubmissions: 0,
          completedAssignments: 0,
          averageStudyTime: 0,
        },
      };
      
      // Save to database
      await addDoc(collection(db, 'classSummaries'), {
        ...initialSummary,
        id: classId, // Use classId as document ID
      });
      
      console.log('Created initial class summary for:', classId);
    } catch (error) {
      console.error('Error creating initial class summary:', error);
      throw error;
    }
  }
  
  // Helper function to get stage from percentage
  private static getStageFromPercentage(percentage: number): 'seed' | 'seedling' | 'sprout' | 'blooming' {
    if (percentage >= 90) return 'blooming';
    if (percentage >= 60) return 'sprout';
    if (percentage > 0) return 'seedling';
    return 'seed';
  }
  
  // Helper function to get student assignment progress
  private static async getStudentAssignmentProgress(studentId: string, classId: string): Promise<{ total: number; completed: number }> {
    try {
      // Get active assignments for the class
      const assignments = await AssignmentService.getClassAssignments(classId);
      const activeAssignments = assignments.filter(a => a.status === 'active');
      
      let total = activeAssignments.length;
      let completed = 0;
      
      for (const assignment of activeAssignments) {
        // Check if student has submitted this assignment
        const submissionQuery = query(
          collection(db, 'submissions'),
          where('assignmentId', '==', assignment.id),
          where('studentId', '==', studentId)
        );
        
        const submissionSnap = await getDocs(submissionQuery);
        
        if (!submissionSnap.empty) {
          const submission = submissionSnap.docs[0];
          const submissionData = submission.data();
          
          if (submissionData.status === 'approved' || 
              submissionData.status === 'submitted' || 
              submissionData.status === 'pending') {
            completed += 1;
          }
        }
      }
      
      return { total, completed };
    } catch (error) {
      console.error('Error getting student assignment progress:', error);
      return { total: 0, completed: 0 };
    }
  }
}
