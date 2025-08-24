import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Brain, ChevronRight, Sparkles } from 'lucide-react';
import AIRecommendationService, { ParentRecommendation } from '../lib/services/aiRecommendations';

interface AIRecommendationWidgetProps {
  parentId: string;
  showChinese?: boolean;
  onViewAll?: () => void;
}

export default function AIRecommendationWidget({ 
  parentId, 
  showChinese = false, 
  onViewAll 
}: AIRecommendationWidgetProps) {
  const [recommendations, setRecommendations] = useState<ParentRecommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRecommendations();
  }, [parentId]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      console.log('Loading recommendations for parent:', parentId);
      const recs = await AIRecommendationService.getParentRecommendations(parentId, 3);
      console.log('Raw recommendations:', recs);
      const unreadRecs = recs.filter(r => !r.isRead);
      console.log('Unread recommendations:', unreadRecs);
      setRecommendations(unreadRecs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = recommendations.length;

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (unreadCount === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <Sparkles className="h-8 w-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm text-gray-500">No new recommendations</p>
            <p className="text-xs text-gray-400 mt-1">
              Click "Test AI Recommendations" button to generate some
            </p>
            {recommendations.length === 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2 text-xs"
                onClick={async () => {
                  console.log('Debug: Fetching ALL recommendations for:', parentId);
                  try {
                    const allRecs = await AIRecommendationService.getParentRecommendations(parentId, 10);
                    console.log('Debug: All recommendations (including read):', allRecs);
                    setRecommendations(allRecs); // Show all for debugging
                  } catch (error) {
                    console.error('Debug: Error fetching all recommendations:', error);
                  }
                }}
              >
                🔍 Debug: Show All Recommendations
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4 text-purple-600" />
            AI Recommendations
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {unreadCount} new
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {recommendations.slice(0, 2).map((recommendation) => (
          <RecommendationItem
            key={recommendation.id}
            recommendation={recommendation}
            showChinese={showChinese}
          />
        ))}
        
        {unreadCount > 2 && (
          <p className="text-xs text-gray-500 text-center py-2">
            +{unreadCount - 2} more recommendations
          </p>
        )}
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="w-full mt-3 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
          onClick={onViewAll}
        >
          View All Recommendations
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

interface RecommendationItemProps {
  recommendation: ParentRecommendation;
  showChinese: boolean;
}

function RecommendationItem({ recommendation, showChinese }: RecommendationItemProps) {
  const englishContent = recommendation.contentEnglish || recommendation.content || '';
  const chineseContent = recommendation.contentChinese;
  
  const truncateText = (text: string, length: number = 80) => 
    text.length > length ? text.substring(0, length) + '...' : text;

  const priorityColor = {
    high: 'bg-red-100 text-red-800',
    medium: 'bg-yellow-100 text-yellow-800',
    low: 'bg-gray-100 text-gray-800'
  }[recommendation.priority];

  return (
    <div className="p-3 bg-gray-50 rounded-lg border-l-4 border-l-purple-500">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="font-medium text-xs text-gray-900">
          {recommendation.title}
        </h4>
        <Badge variant="outline" className={`text-xs px-1.5 py-0.5 ${priorityColor}`}>
          {recommendation.priority}
        </Badge>
      </div>
      
      {/* English Content */}
      {englishContent && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-500 mb-1">🇺🇸 English:</p>
          <p className="text-xs text-gray-700 leading-relaxed pl-2">
            {truncateText(englishContent)}
          </p>
        </div>
      )}
      
      {/* Chinese Content */}
      {chineseContent && (
        <div className="mb-2">
          <p className="text-xs font-medium text-gray-500 mb-1">🇨🇳 中文:</p>
          <p className="text-xs text-gray-700 leading-relaxed pl-2">
            {truncateText(chineseContent)}
          </p>
        </div>
      )}
      
      <div className="flex justify-between items-center mt-2">
        <Badge variant="outline" className="text-xs">
          {recommendation.category.replace('_', ' ')}
        </Badge>
        <span className="text-xs text-gray-400">
          {recommendation.createdAt.toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}
