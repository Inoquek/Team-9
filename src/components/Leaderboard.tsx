import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Crown, Star, TrendingUp } from "lucide-react";
import { LeaderboardEntry } from "@/lib/types";
import { GamificationService } from "@/lib/services/gamification";

export const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLeaderboard = async () => {
      try {
        const data = await GamificationService.getLeaderboard(20);
        setLeaderboard(data);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLeaderboard();

    // Subscribe to real-time updates
    const unsubscribe = GamificationService.subscribeToLeaderboard(setLeaderboard);
    return () => unsubscribe();
  }, []);

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
    return <Star className="h-5 w-4 text-muted-foreground" />;
  };

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-100 border-yellow-200';
    if (rank === 2) return 'bg-gray-100 border-gray-200';
    if (rank === 3) return 'bg-amber-100 border-amber-200';
    return 'bg-white border-gray-200';
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <span>Family Leaderboard</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {leaderboard.map((entry, index) => (
            <div
              key={entry.id}
              className={`flex items-center space-x-3 p-3 rounded-lg border ${getRankColor(entry.rank)}`}
            >
              {/* Rank */}
              <div className="flex-shrink-0 w-8 text-center">
                {getRankIcon(entry.rank)}
              </div>

              {/* Family Info */}
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground truncate">
                  {entry.familyName}
                </h4>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {entry.badges.length} badges
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Last active: {entry.lastActivity.toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Points */}
              <div className="flex-shrink-0 text-right">
                <div className="text-lg font-bold text-primary">
                  {entry.totalPoints.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">points</div>
              </div>
            </div>
          ))}
        </div>

        {leaderboard.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>No leaderboard data available yet</p>
            <p className="text-sm">Complete assignments to earn points!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
