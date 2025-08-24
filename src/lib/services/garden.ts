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
      const relevantAssignments = assignments.filter(a => a.status === 'active' || a.status === 'completed');
      
      // Calculate completion data for each student
      const studentData: GardenStudentData[] = [];
      let totalCompleted = 0;
      let totalStudyTime = 0;
      let newSubmissions = 0;
      
      for (const student of students) {
        const { total, completed, totalPoints, earnedPoints } = await this.getStudentAssignmentProgress(student.id, classId);
        const completionRate = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
        
        studentData.push({
          id: student.id,
          name: student.name,
          completionRate,
          stage: this.getStageFromPercentage(completionRate),
          totalAssignments: total,
          completedAssignments: completed,
          totalPoints: totalPoints,
          earnedPoints: earnedPoints,
          lastActivity: new Date(), // TODO: Get actual last activity
        });
        
        totalCompleted += completed;
        
        // TODO: Get actual study time and submission counts
        if (completed > 0) newSubmissions += 1;
      }
      
      // Calculate performance distribution
      const performanceDistribution = {
        fruiting: studentData.filter(s => s.stage === 'fruiting').length,
        blooming: studentData.filter(s => s.stage === 'blooming').length,
        flowering: studentData.filter(s => s.stage === 'flowering').length,
        budding: studentData.filter(s => s.stage === 'budding').length,
        sprout: studentData.filter(s => s.stage === 'sprout').length,
        growing: studentData.filter(s => s.stage === 'growing').length,
        seedling: studentData.filter(s => s.stage === 'seedling').length,
        germinating: studentData.filter(s => s.stage === 'germinating').length,
        seed: studentData.filter(s => s.stage === 'seed').length,
      };
      
      // Create class summary
      const classSummary: Omit<ClassSummary, 'id'> = {
        classId,
        className: '', // TODO: Get from class document
        teacherId: '', // TODO: Get from class document
        lastUpdated: new Date(),
        totalStudents: students.length,
        averageCompletionRate: students.length > 0 ? Math.round(totalCompleted / (students.length * relevantAssignments.length) * 100) : 0,
        totalAssignments: relevantAssignments.length,
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
    allKindergartenStudents: GardenStudentData[];
  }> {
    try {
      console.log('Getting garden data for parent:', parentId);
      
      // Get parent's children
      const children = await StudentService.getStudentsByParent(parentId);
      console.log('Found children:', children);
      
      if (children.length === 0) {
        console.log('No children found for parent');
        return { classSummaries: [], ownChildrenData: [], allKindergartenStudents: [] };
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
          console.log(`GardenService: Getting progress for child ${child.name} (${child.id}) in class ${child.classId}`);
          const { total, completed, totalPoints, earnedPoints } = await this.getStudentAssignmentProgress(child.id, child.classId);
          const completionRate = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
          
          console.log(`GardenService: Child ${child.name} progress: ${completed}/${total} assignments, ${earnedPoints}/${totalPoints} points, ${completionRate}% completion rate`);
          
          ownChildrenData.push({
            id: child.id,
            name: child.name,
            completionRate,
            stage: this.getStageFromPercentage(completionRate),
            totalAssignments: total,
            completedAssignments: completed,
            totalPoints: totalPoints,
            earnedPoints: earnedPoints,
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
            totalPoints: 0,
            earnedPoints: 0,
            lastActivity: new Date(),
            isOwnChild: true,
          });
        }
      }
      
      // Get all students in the kindergarten (all classes) for the whole garden view
      const allKindergartenStudents: GardenStudentData[] = [];
      for (const classId of classIds) {
        try {
          console.log(`GardenService: Loading students for class ${classId}`);
          const students = await StudentService.getStudentsByClass(classId);
          console.log(`GardenService: Found ${students.length} students in class ${classId}`);
          
          for (const student of students) {
            // Check if this is the parent's own child
            const isOwnChild = children.some(child => child.id === student.id);
            
            console.log(`GardenService: Processing student ${student.name} (${student.id}), isOwnChild: ${isOwnChild}`);
            const { total, completed, totalPoints, earnedPoints } = await this.getStudentAssignmentProgress(student.id, classId);
            const completionRate = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;
            
            console.log(`GardenService: Student ${student.name} progress: ${completed}/${total} assignments, ${earnedPoints}/${totalPoints} points, ${completionRate}% completion rate`);
            
            allKindergartenStudents.push({
              id: student.id,
              name: isOwnChild ? student.name : `Student ${student.id.slice(-4)}`, // Anonymize other students
              completionRate,
              stage: this.getStageFromPercentage(completionRate),
              totalAssignments: total,
              completedAssignments: completed,
              totalPoints: totalPoints,
              earnedPoints: earnedPoints,
              lastActivity: new Date(),
              isOwnChild,
            });
          }
        } catch (error) {
          console.warn('Error getting students for class', classId, ':', error);
        }
      }
      
      console.log('Final result:', { 
        classSummaries: classSummaries.length, 
        ownChildrenData: ownChildrenData.length,
        allKindergartenStudents: allKindergartenStudents.length
      });
      return { classSummaries, ownChildrenData, allKindergartenStudents };
    } catch (error) {
      console.error('Error getting garden data for parent:', error);
      // Return empty data instead of throwing
      return { classSummaries: [], ownChildrenData: [], allKindergartenStudents: [] };
    }
  }
  
  // Create initial class summary when none exists
  private static async createInitialClassSummary(classId: string): Promise<void> {
    try {
      // Get basic class info
      const students = await StudentService.getStudentsByClass(classId);
      const assignments = await AssignmentService.getClassAssignments(classId);
      const relevantAssignments = assignments.filter(a => a.status === 'active' || a.status === 'completed');
      
      // Create basic summary
      const initialSummary: Omit<ClassSummary, 'id'> = {
        classId,
        className: `Class ${classId.slice(-4)}`, // Use last 4 chars of classId as name
        teacherId: '', // Will be filled when teacher accesses
        lastUpdated: new Date(),
        totalStudents: students.length,
        averageCompletionRate: 0, // No assignments completed yet
        totalAssignments: relevantAssignments.length,
        completedAssignments: 0,
        performanceDistribution: {
          fruiting: 0,
          blooming: 0,
          flowering: 0,
          budding: 0,
          sprout: 0,
          growing: 0,
          seedling: 0,
          germinating: 0,
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
  
  // Helper function to get stage from percentage with more granular stages
  private static getStageFromPercentage(percentage: number): 'seed' | 'germinating' | 'seedling' | 'growing' | 'sprout' | 'budding' | 'flowering' | 'blooming' | 'fruiting' {
    if (percentage >= 95) return 'fruiting';
    if (percentage >= 90) return 'blooming';
    if (percentage >= 80) return 'flowering';
    if (percentage >= 70) return 'budding';
    if (percentage >= 60) return 'sprout';
    if (percentage >= 45) return 'growing';
    if (percentage >= 25) return 'seedling';
    if (percentage >= 10) return 'germinating';
    return 'seed';
  }
  
  // Helper function to get student assignment progress
  private static async getStudentAssignmentProgress(studentId: string, classId: string): Promise<{ 
    total: number; 
    completed: number; 
    totalPoints: number; 
    earnedPoints: number; 
  }> {
    try {
      // Get all assignments for the class (not just active ones)
      const assignments = await AssignmentService.getClassAssignments(classId);
      // Include active and completed assignments for progress calculation
      const relevantAssignments = assignments.filter(a => a.status === 'active' || a.status === 'completed');
      
      console.log(`GardenService: Found ${assignments.length} total assignments, ${relevantAssignments.length} relevant for student ${studentId} in class ${classId}`);
      
      let total = relevantAssignments.length;
      let completed = 0;
      let totalPoints = 0;
      let earnedPoints = 0;
      
      for (const assignment of relevantAssignments) {
        const assignmentPoints = assignment.points || 0;
        totalPoints += assignmentPoints;
        
        console.log(`GardenService: Processing assignment ${assignment.id} (${assignment.title || 'Untitled'}) - ${assignmentPoints} points, status: ${assignment.status}`);
        
        // Check if student has submitted this assignment
        const submissionQuery = query(
          collection(db, 'submissions'),
          where("assignmentId", "==", assignment.id),
          where("studentId", "==", studentId)
        );
        
        const submissionSnap = await getDocs(submissionQuery);
        
        if (!submissionSnap.empty) {
          const submission = submissionSnap.docs[0];
          const submissionData = submission.data();
          
          console.log(`GardenService: Student ${studentId} has submission for assignment ${assignment.id}, status: ${submissionData.status}`);
          
          // Consider approved, submitted, pending, and completed as completed
          if (submissionData.status === 'approved' || 
              submissionData.status === 'submitted' || 
              submissionData.status === 'pending' ||
              submissionData.status === 'completed') {
            completed += 1;
            
            // Calculate actual earned points based on submission data
            let earnedPointsForAssignment = 0;
            
            if (submissionData.status === 'approved' && submissionData.feedback && submissionData.feedback.points) {
              // If approved with feedback, use the feedback points (teacher's assessment)
              earnedPointsForAssignment = submissionData.feedback.points;
              console.log(`GardenService: Assignment ${assignment.id} approved with ${earnedPointsForAssignment} points from feedback`);
            } else if (submissionData.points && submissionData.points > 0) {
              // If submission has points assigned, use those
              earnedPointsForAssignment = submissionData.points;
              console.log(`GardenService: Assignment ${assignment.id} has ${earnedPointsForAssignment} points assigned`);
            } else {
              // If no points assigned yet, give partial credit for completion (e.g., 50% of max points)
              earnedPointsForAssignment = Math.round(assignmentPoints * 0.5);
              console.log(`GardenService: Assignment ${assignment.id} completed but no points assigned, giving partial credit: ${earnedPointsForAssignment} points`);
            }
            
            earnedPoints += earnedPointsForAssignment;
            console.log(`GardenService: Assignment ${assignment.id} marked as completed for student ${studentId}, earned ${earnedPointsForAssignment} points`);
          }
        } else {
          console.log(`GardenService: Student ${studentId} has no submission for assignment ${assignment.id}`);
        }
      }
      
      console.log(`GardenService: Final progress for student ${studentId}: ${completed}/${total} assignments, ${earnedPoints}/${totalPoints} points`);
      return { total, completed, totalPoints, earnedPoints };
    } catch (error) {
      console.error('Error getting student assignment progress:', error);
      return { total: 0, completed: 0, totalPoints: 0, earnedPoints: 0 };
    }
  }
}
