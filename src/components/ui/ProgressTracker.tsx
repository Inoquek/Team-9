import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Star, TrendingUp, Award, Target } from "lucide-react";
import { Portfolio, CategoryProgress } from "@/lib/types";

interface ProgressTrackerProps {
  portfolio: Portfolio;
  className?: string;
}

export const ProgressTracker = ({ portfolio, className }: ProgressTrackerProps) => {
  const categories = [
    { key: 'alphabet', label: 'Alphabet', icon: '🔤', color: 'text-blue-500', bgColor: 'bg-blue-50' },
    { key: 'vocabulary', label: 'Vocabulary', icon: '📚', color: 'text-green-500', bgColor: 'bg-green-50' },
    { key: 'sightWords', label: 'Sight Words', icon: '👁️', color: 'text-purple-500', bgColor: 'bg-purple-50' },
    { key: 'reading', label: 'Reading', icon: '📖', color: 'text-orange-500', bgColor: 'bg-orange-50' },
    { key: 'writing', label: 'Writing', icon: '✏️', color: 'text-red-500', bgColor: 'bg-red-50' }
  ];

  const getCategoryProgress = (categoryKey: keyof Portfolio['categories']): CategoryProgress => {
    return portfolio.categories[categoryKey];
  };

  const getProgressPercentage = (progress: CategoryProgress): number => {
    if (progress.totalAssignments === 0) return 0;
    return Math.round((progress.completedAssignments / progress.totalAssignments) * 100);
  };

  const getLevelColor = (level: number): string => {
    if (level >= 5) return 'text-yellow-500';
    if (level >= 3) return 'text-green-500';
    if (level >= 1) return 'text-blue-500';
    return 'text-gray-500';
  };

  const getLevelBadge = (level: number) => {
    if (level >= 5) return { text: 'Master', variant: 'default' as const, icon: Trophy };
    if (level >= 3) return { text: 'Advanced', variant: 'secondary' as const, icon: Star };
    if (level >= 1) return { text: 'Beginner', variant: 'outline' as const, icon: Target };
    return { text: 'New', variant: 'outline' as const, icon: Target };
  };

  return (
    <div className={className}>
      {/* Overall Progress Summary */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span>Overall Progress</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{portfolio.totalPoints}</div>
              <div className="text-sm text-muted-foreground">Total Points</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {portfolio.badges.length}
              </div>
              <div className="text-sm text-muted-foreground">Badges Earned</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {Object.values(portfolio.categories).reduce((sum, cat) => sum + cat.completedAssignments, 0)}
              </div>
              <div className="text-sm text-muted-foreground">Completed Tasks</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => {
          const progress = getCategoryProgress(category.key as keyof Portfolio['categories']);
          const percentage = getProgressPercentage(progress);
          const levelBadge = getLevelBadge(progress.level);
          const LevelIcon = levelBadge.icon;

          return (
            <Card key={category.key} className={`${category.bgColor} border-0`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">{category.icon}</span>
                    <div>
                      <h3 className="font-semibold text-foreground">{category.label}</h3>
                      <p className="text-xs text-muted-foreground">Level {progress.level}</p>
                    </div>
                  </div>
                  <Badge variant={levelBadge.variant} className="flex items-center space-x-1">
                    <LevelIcon className="h-3 w-3" />
                    <span>{levelBadge.text}</span>
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Progress</span>
                    <span className="font-medium">{percentage}%</span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-center p-2 bg-white/50 rounded-lg">
                    <div className="font-semibold text-foreground">{progress.points}</div>
                    <div className="text-xs text-muted-foreground">Points</div>
                  </div>
                  <div className="text-center p-2 bg-white/50 rounded-lg">
                    <div className="font-semibold text-foreground">
                      {progress.completedAssignments}/{progress.totalAssignments}
                    </div>
                    <div className="text-xs text-muted-foreground">Completed</div>
                  </div>
                </div>

                {/* Last Activity */}
                <div className="text-xs text-muted-foreground text-center">
                  Last activity: {progress.lastActivity.toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent Achievements */}
      {portfolio.badges.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Award className="h-5 w-5 text-yellow-500" />
              <span>Recent Achievements</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {portfolio.badges.slice(-6).map((badge, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-muted/50 rounded-lg">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-lg">{badge.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm text-foreground truncate">{badge.name}</h4>
                    <p className="text-xs text-muted-foreground truncate">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Trends */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            <span>Progress Trends</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Progress tracking charts will be displayed here</p>
            <p className="text-sm">Coming soon with detailed analytics</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
        