import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';
import { 
  Brain, 
  BookOpen, 
  TrendingUp, 
  Users, 
  Clock,
  Check,
  Star,
  Lightbulb,
  Globe
} from 'lucide-react';
import AIRecommendationService, { ParentRecommendation } from '../lib/services/aiRecommendations';

interface AIRecommendationsPanelProps {
  parentId: string;
  showChinese?: boolean;
}

const categoryIcons = {
  study_habits: BookOpen,
  assignment_help: Lightbulb,
  progress_encouragement: TrendingUp,
  parent_engagement: Users,
  time_management: Clock
};

const categoryColors = {
  study_habits: 'bg-blue-50 text-blue-700 border-blue-200',
  assignment_help: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  progress_encouragement: 'bg-green-50 text-green-700 border-green-200',
  parent_engagement: 'bg-purple-50 text-purple-700 border-purple-200',
  time_management: 'bg-orange-50 text-orange-700 border-orange-200'
};

const priorityColors = {
  high: 'bg-red-50 text-red-700 border-red-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-gray-50 text-gray-700 border-gray-200'
};

export default function AIRecommendationsPanel({ parentId, showChinese = false }: AIRecommendationsPanelProps) {
  const [recommendations, setRecommendations] = useState<ParentRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('unread');
  const [language, setLanguage] = useState<'en' | 'zh'>(showChinese ? 'zh' : 'en');

  useEffect(() => {
    loadRecommendations();
  }, [parentId]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      const recs = await AIRecommendationService.getParentRecommendations(parentId, 20);
      setRecommendations(recs);
    } catch (error) {
      console.error('Error loading recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (recommendationId: string) => {
    try {
      await AIRecommendationService.markRecommendationAsRead(recommendationId);
      setRecommendations(prev => 
        prev.map(rec => 
          rec.id === recommendationId 
            ? { ...rec, isRead: true }
            : rec
        )
      );
    } catch (error) {
      console.error('Error marking recommendation as read:', error);
    }
  };

  const filteredRecommendations = recommendations.filter(rec => 
    activeTab === 'all' ? true : !rec.isRead
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-purple-600" />
            AI Recommendations
            <Badge variant="secondary" className="ml-2">
              {filteredRecommendations.filter(r => !r.isRead).length} new
            </Badge>
          </CardTitle>
          
          {showChinese && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLanguage(lang => lang === 'en' ? 'zh' : 'en')}
              className="flex items-center gap-1"
            >
              <Globe className="h-4 w-4" />
              {language === 'en' ? '中文' : 'EN'}
            </Button>
          )}
        </div>
        
        <CardDescription>
          Personalized suggestions to support your child's learning journey
        </CardDescription>
      </CardHeader>

      <CardContent className="p-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | 'unread')}>
          <div className="px-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="unread" className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                New ({recommendations.filter(r => !r.isRead).length})
              </TabsTrigger>
              <TabsTrigger value="all">
                All ({recommendations.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="unread" className="mt-4 mx-0">
            <RecommendationsList 
              recommendations={filteredRecommendations}
              language={language}
              onMarkAsRead={markAsRead}
            />
          </TabsContent>

          <TabsContent value="all" className="mt-4 mx-0">
            <RecommendationsList 
              recommendations={filteredRecommendations}
              language={language}
              onMarkAsRead={markAsRead}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

interface RecommendationsListProps {
  recommendations: ParentRecommendation[];
  language: 'en' | 'zh';
  onMarkAsRead: (id: string) => void;
}

function RecommendationsList({ recommendations, language, onMarkAsRead }: RecommendationsListProps) {
  if (recommendations.length === 0) {
    return (
      <div className="px-6 py-8 text-center text-gray-500">
        <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
        <p>No recommendations available</p>
        <p className="text-sm mt-1">Check back later for personalized suggestions</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="px-6 space-y-3 pb-4">
        {recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.id}
            recommendation={recommendation}
            language={language}
            onMarkAsRead={onMarkAsRead}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

interface RecommendationCardProps {
  recommendation: ParentRecommendation;
  language: 'en' | 'zh';
  onMarkAsRead: (id: string) => void;
}

function RecommendationCard({ recommendation, language, onMarkAsRead }: RecommendationCardProps) {
  const IconComponent = categoryIcons[recommendation.category];
  const content = language === 'zh' ? recommendation.contentChinese : recommendation.content;
  
  return (
    <div className={`
      border rounded-lg p-4 transition-all hover:shadow-md
      ${recommendation.isRead ? 'bg-gray-50 opacity-75' : 'bg-white'}
      ${!recommendation.isRead ? 'border-l-4 border-l-purple-500' : ''}
    `}>
      <div className="flex items-start gap-3">
        <div className={`
          flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center
          ${categoryColors[recommendation.category]}
        `}>
          <IconComponent className="h-5 w-5" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-medium text-sm ${recommendation.isRead ? 'text-gray-600' : 'text-gray-900'}`}>
              {recommendation.title}
            </h4>
            
            <Badge 
              variant="outline" 
              className={`text-xs ${priorityColors[recommendation.priority]}`}
            >
              {recommendation.priority}
            </Badge>
            
            {!recommendation.isRead && (
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
            )}
          </div>
          
          <p className={`text-sm leading-relaxed ${recommendation.isRead ? 'text-gray-500' : 'text-gray-700'}`}>
            {content}
          </p>
          
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {recommendation.category.replace('_', ' ')}
              </Badge>
              
              <span className="text-xs text-gray-400">
                {recommendation.createdAt.toLocaleDateString()}
              </span>
            </div>
            
            {!recommendation.isRead && recommendation.id && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkAsRead(recommendation.id!)}
                className="text-xs h-7 px-2"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark read
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
