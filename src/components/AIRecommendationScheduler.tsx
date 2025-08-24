import { useEffect } from 'react';
import AIRecommendationService from '../lib/services/aiRecommendations';

interface AIRecommendationSchedulerProps {
  enabled?: boolean;
}

export default function AIRecommendationScheduler({ enabled = true }: AIRecommendationSchedulerProps) {
  useEffect(() => {
    if (!enabled) return;

    // Check if recommendations should be generated
    const shouldGenerateRecommendations = () => {
      const lastGenerated = localStorage.getItem('ai-recommendations-last-generated');
      
      if (!lastGenerated) return true;
      
      const lastDate = new Date(lastGenerated);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Generate recommendations once per week
      return daysDiff >= 7;
    };

    const generateRecommendationsForAllClasses = async () => {
      try {
        console.log('Starting weekly AI recommendations generation...');
        
        // Get all active classes
        // Note: You might want to fetch this from your classes service
        const activeClasses = [
          // Add your class IDs here, or fetch from database
          // 'class-id-1', 'class-id-2', etc.
        ];

        for (const classId of activeClasses) {
          await AIRecommendationService.generateBatchRecommendations(classId);
          console.log(`Generated recommendations for class: ${classId}`);
        }

        // Mark as generated
        localStorage.setItem('ai-recommendations-last-generated', new Date().toISOString());
        console.log('Weekly AI recommendations generation completed');
        
      } catch (error) {
        console.error('Error generating weekly recommendations:', error);
      }
    };

    // Run on mount if needed
    if (shouldGenerateRecommendations()) {
      // Add slight delay to avoid blocking app startup
      setTimeout(generateRecommendationsForAllClasses, 5000);
    }

    // Set up weekly interval (run every 7 days)
    const interval = setInterval(() => {
      if (shouldGenerateRecommendations()) {
        generateRecommendationsForAllClasses();
      }
    }, 24 * 60 * 60 * 1000); // Check daily, but only generate weekly

    return () => clearInterval(interval);
  }, [enabled]);

  // This component doesn't render anything
  return null;
}

// Manual trigger function for admin use
export const manualGenerateRecommendations = async (classIds: string[]) => {
  try {
    console.log('Manual AI recommendations generation started...');
    
    for (const classId of classIds) {
      await AIRecommendationService.generateBatchRecommendations(classId);
    }
    
    localStorage.setItem('ai-recommendations-last-generated', new Date().toISOString());
    console.log('Manual AI recommendations generation completed');
    
    return { success: true, message: 'Recommendations generated successfully' };
  } catch (error) {
    console.error('Manual recommendations generation error:', error);
    return { success: false, error: error.message };
  }
};
