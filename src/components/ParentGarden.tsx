import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Sprout, Apple, Award, Users, TrendingUp, Clock, BookOpen, Eye, EyeOff, Crown, Medal, Star, Trophy, Target } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { GardenService } from "@/lib/services/garden";
import type { ClassSummary, GardenStudentData, User } from "@/lib/types";

export const ParentGarden = () => {
  const { user } = useAuth() as { user: User };
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);
  const [ownChildrenData, setOwnChildrenData] = useState<GardenStudentData[]>([]);
  const [allKindergartenStudents, setAllKindergartenStudents] = useState<GardenStudentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWholeGarden, setShowWholeGarden] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadGardenData() {
      if (!user || user.role !== "parent") return;
      
      setLoading(true);
      try {
        const gardenData = await GardenService.getGardenDataForParent(user.uid);
        
        if (!cancelled) {
          setClassSummaries(gardenData.classSummaries);
          setOwnChildrenData(gardenData.ownChildrenData);
          setAllKindergartenStudents(gardenData.allKindergartenStudents);
        }
      } catch (error) {
        console.error('Error loading garden data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadGardenData();
    return () => { cancelled = true; };
  }, [user?.uid, user?.role]);

  const totalChildren = ownChildrenData.length;
  const avgCompletionRate = totalChildren > 0 
    ? Math.round(ownChildrenData.reduce((sum, child) => sum + child.completionRate, 0) / totalChildren)
    : 0;

  const bloomingChildren = ownChildrenData.filter(child => child.stage === 'blooming').length;
  
  // Calculate statistics for the whole garden
  const totalGardenStudents = allKindergartenStudents.length;
  const avgGardenCompletionRate = totalGardenStudents > 0 
    ? Math.round(allKindergartenStudents.reduce((sum, student) => sum + student.completionRate, 0) / totalGardenStudents)
    : 0;
  const bloomingGardenStudents = allKindergartenStudents.filter(student => student.stage === 'blooming').length;
  
  // Points-based statistics
  const totalPointsEarned = ownChildrenData.reduce((sum, child) => sum + child.earnedPoints, 0);
  const totalPointsAvailable = ownChildrenData.reduce((sum, child) => sum + child.totalPoints, 0);
  const gardenTotalPointsEarned = allKindergartenStudents.reduce((sum, student) => sum + student.earnedPoints, 0);
  const gardenTotalPointsAvailable = allKindergartenStudents.reduce((sum, student) => sum + student.totalPoints, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading garden...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Children's Garden</h1>
          <p className="text-muted-foreground mt-1">
            {showWholeGarden 
              ? "See how all students in your children's classes are growing together. Your children are highlighted."
              : "Watch your children grow and see their individual progress."
            }
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/assignments'}
            className="flex items-center gap-2 bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
          >
            <BookOpen className="h-4 w-4" />
            View Assignments
          </Button>
          <Button
            variant={showWholeGarden ? "default" : "outline"}
            size="sm"
            onClick={() => setShowWholeGarden(!showWholeGarden)}
            className="flex items-center gap-2"
          >
            {showWholeGarden ? (
              <>
                <Eye className="h-4 w-4" />
                Whole Garden
              </>
            ) : (
              <>
                <EyeOff className="h-4 w-4" />
                My Children Only
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-7 w-7 text-emerald-600" />
              <div>
                <p className="text-2xl font-bold">{totalChildren}</p>
                <p className="text-sm text-muted-foreground">My Children</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-7 w-7 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">
                  {showWholeGarden ? allKindergartenStudents.length : totalChildren}
                </p>
                <p className="text-sm text-muted-foreground">
                  {showWholeGarden ? 'Total in Garden' : 'My Children'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-lime-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Sprout className="h-7 w-7 text-lime-600" />
              <div>
                <p className="text-2xl font-bold">
                  {showWholeGarden ? avgGardenCompletionRate : avgCompletionRate}%
                </p>
                <p className="text-sm text-muted-foreground">
                  {showWholeGarden ? 'Garden Average' : 'My Children\'s Progress'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {showWholeGarden 
                    ? `(${gardenTotalPointsEarned}/${gardenTotalPointsAvailable} pts)`
                    : `(${totalPointsEarned}/${totalPointsAvailable} pts)`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Award className="h-7 w-7 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">
                  {showWholeGarden ? bloomingGardenStudents : bloomingChildren}
                </p>
                <p className="text-sm text-muted-foreground">
                  {showWholeGarden ? 'Garden Blooming' : 'Blooming (≥90%)'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Trophy className="h-7 w-7 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">
                  {showWholeGarden ? gardenTotalPointsEarned : totalPointsEarned}
                </p>
                <p className="text-sm text-muted-foreground">
                  {showWholeGarden ? 'Garden Points' : 'Points Earned'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {showWholeGarden 
                    ? `of ${gardenTotalPointsAvailable} available`
                    : `of ${totalPointsAvailable} available`
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assignments Action Card */}
        <Card className="border-l-4 border-l-indigo-500 bg-gradient-to-r from-indigo-50 to-blue-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BookOpen className="h-7 w-7 text-indigo-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-indigo-800">
                  Ready to improve rankings?
                </p>
                <p className="text-xs text-indigo-600 mt-1">
                  Complete assignments to earn more points
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.href = '/assignments'}
                className="bg-indigo-100 border-indigo-200 text-indigo-700 hover:bg-indigo-200"
              >
                Go to Assignments
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Children Section */}
      {!showWholeGarden && ownChildrenData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sprout className="h-5 w-5 text-emerald-600" />
              My Children's Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownChildrenData.map((child) => (
                <Card key={child.id} className="border-2 border-emerald-200 bg-emerald-50/30">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sprout className="h-5 w-5 text-emerald-600" />
                      <span>{child.name}</span>
                      <Badge className={getStageBadgeClass(child.stage)}>
                        {getStageLabel(child.stage)}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress</span>
                      <span className="text-muted-foreground">{child.completionRate}%</span>
                    </div>
                    <Progress value={child.completionRate} />
                    
                    <div className="text-xs text-muted-foreground">
                      {child.completedAssignments}/{child.totalAssignments} assignments completed
                    </div>

                    {child.completionRate >= 100 && (
                      <div className="flex items-center gap-2 text-emerald-700 text-sm">
                        <Apple className="h-4 w-4" />
                        Ripe! Great job 🎉
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Performers and Child's Position */}
      {showWholeGarden && allKindergartenStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5" />
              Class Performance Overview
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              See the top performers and where your children stand
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Top 3 Performers */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Top Performers</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(() => {
                  const scores = allKindergartenStudents.map(s => s.completionRate);
                  const topScores = scores.sort((a, b) => b - a).slice(0, 3);
                  
                  return topScores.map((score, index) => (
                    <div key={index} className="text-center p-4 bg-gradient-to-br from-yellow-50 to-amber-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        {index === 0 && <Crown className="h-5 w-5 text-yellow-600" />}
                        {index === 1 && <Medal className="h-5 w-5 text-slate-600" />}
                        {index === 2 && <Star className="h-5 w-5 text-slate-600" />}
                        <span className="text-2xl font-bold text-yellow-600">#{index + 1}</span>
                      </div>
                      <div className="text-lg font-semibold text-gray-700">{score}%</div>
                      <div className="text-xs text-gray-600">Points Score</div>
                    </div>
                  ));
                })()}
              </div>
            </div>

            {/* Separator */}
            <div className="flex items-center justify-center">
              <div className="w-16 h-px bg-gray-300"></div>
              <span className="px-4 text-gray-400 text-sm">...</span>
              <div className="w-16 h-px bg-gray-300"></div>
            </div>

            {/* Your Children's Positions */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Your Children's Positions</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ownChildrenData.map((child) => {
                  // Calculate child's rank
                  const childRank = allKindergartenStudents
                    .sort((a, b) => b.completionRate - a.completionRate)
                    .findIndex(s => s.id === child.id) + 1;
                  
                  // Calculate improvement potential
                  const incompleteAssignments = child.totalAssignments - child.completedAssignments;
                  const potentialScore = child.totalPoints > 0 
                    ? Math.round(((child.earnedPoints + (child.totalPoints - child.earnedPoints)) / child.totalPoints) * 100)
                    : 0;
                  
                  // Find what rank they could achieve with perfect completion
                  const potentialRank = allKindergartenStudents
                    .map(s => {
                      if (s.id === child.id) {
                        return { ...s, completionRate: potentialScore };
                      }
                      return s;
                    })
                    .sort((a, b) => b.completionRate - a.completionRate)
                    .findIndex(s => s.id === child.id) + 1;
                  
                  const rankImprovement = childRank - potentialRank;
                  const pointsAvailable = child.totalPoints - child.earnedPoints;
                  
                  return (
                    <div key={child.id} className="p-6 bg-emerald-50 rounded-lg border-2 border-emerald-200">
                      {/* Main Position Info */}
                      <div className="text-center mb-4">
                        <div className="flex items-center justify-center gap-2 mb-2">
                          {childRank === 1 && <Crown className="h-5 w-5 text-yellow-600" />}
                          {childRank === 2 && <Medal className="h-5 w-5 text-slate-600" />}
                          {childRank === 3 && <Star className="h-5 w-5 text-amber-600" />}
                          {childRank > 3 && <Trophy className="h-5 w-5 text-blue-600" />}
                          <span className="text-2xl font-bold text-emerald-600">#{childRank}</span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                          out of {allKindergartenStudents.length} students
                        </p>
                        <div className="text-2xl font-bold text-green-600 mb-2">
                          {child.completionRate}%
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{child.name}'s Score</p>
                        <Progress 
                          value={child.completionRate} 
                          className="h-2 mb-3"
                        />
                        <Badge className={getStageBadgeClass(child.stage)}>
                          {getStageLabel(child.stage)}
                        </Badge>
                      </div>

                      {/* Improvement Potential Section */}
                      <div className="border-t border-emerald-200 pt-4">
                        <h5 className="text-sm font-medium text-emerald-700 mb-3 text-center">
                          📈 Improvement Potential
                        </h5>
                        
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="text-center p-2 bg-white rounded border border-emerald-200">
                            <div className="text-lg font-bold text-blue-600">{incompleteAssignments}</div>
                            <div className="text-xs text-blue-700">Pending</div>
                          </div>
                          <div className="text-center p-2 bg-white rounded border border-emerald-200">
                            <div className="text-lg font-bold text-orange-600">{pointsAvailable}</div>
                            <div className="text-xs text-orange-700">Points Available</div>
                          </div>
                        </div>

                        {rankImprovement > 0 && (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                            <div className="flex items-center gap-2 text-yellow-800 mb-1">
                              <TrendingUp className="h-4 w-4" />
                              <span className="text-sm font-medium">Rank Improvement!</span>
                            </div>
                            <p className="text-xs text-yellow-700">
                              Completing all assignments could move {child.name} from #{childRank} to #{potentialRank} 
                              <span className="block mt-1 font-medium">(+{rankImprovement} positions)</span>
                            </p>
                          </div>
                        )}

                        {rankImprovement === 0 && (
                          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-green-800">
                              <Trophy className="h-4 w-4" />
                              <span className="text-sm font-medium">Excellent Progress!</span>
                            </div>
                            <p className="text-xs text-green-700 mt-1">
                              {child.name} has completed all available assignments. Great work!
                            </p>
                          </div>
                        )}

                        {/* Motivational message */}
                        <div className="mt-3 text-sm text-emerald-600 text-center">
                          {childRank === 1 && "🏆 Your child is the champion!"}
                          {childRank === 2 && "🥈 Fantastic second place!"}
                          {childRank === 3 && "🥉 Great third place!"}
                          {childRank <= 5 && childRank > 3 && "🔥 Top 5 - Amazing work!"}
                          {childRank <= 10 && childRank > 5 && "⭐ Top 10 - Keep it up!"}
                          {childRank <= 25 && childRank > 10 && "💪 Top 25% - Good progress!"}
                          {childRank > 25 && "📚 Keep learning and improving!"}
                        </div>

                        {/* Assignments Button */}
                        {incompleteAssignments > 0 && (
                          <div className="mt-4 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.location.href = '/assignments'}
                              className="flex items-center gap-2 mx-auto bg-orange-50 border-orange-200 text-orange-700 hover:bg-orange-100"
                            >
                              <BookOpen className="h-4 w-4" />
                              Complete {incompleteAssignments} Assignment{incompleteAssignments !== 1 ? 's' : ''}
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Performance Tiers */}
      {showWholeGarden && allKindergartenStudents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Tiers
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              See how many students are in each performance level
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div className="text-2xl font-bold text-emerald-600">
                  {allKindergartenStudents.filter(s => s.stage === 'blooming').length}
                </div>
                <div className="text-sm font-medium text-emerald-700">Elite (90%+)</div>
                <div className="text-xs text-emerald-600">Top Performers</div>
              </div>
              
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">
                  {allKindergartenStudents.filter(s => s.stage === 'sprout').length}
                </div>
                <div className="text-sm font-medium text-blue-700">Advanced (70-89%)</div>
                <div className="text-xs text-blue-600">Strong Performers</div>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">
                  {allKindergartenStudents.filter(s => s.stage === 'seedling').length}
                </div>
                <div className="text-sm font-medium text-yellow-700">Intermediate (50-69%)</div>
                <div className="text-xs text-yellow-600">Good Progress</div>
              </div>
              
              <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="text-2xl font-bold text-orange-600">
                  {allKindergartenStudents.filter(s => s.stage === 'seed').length}
                </div>
                <div className="text-sm font-medium text-orange-700">Developing (&lt;50%)</div>
                <div className="text-xs text-orange-600">Keep Learning</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Class Performance Section */}
      {classSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-600" />
              Class Performance Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {classSummaries.map((summary) => (
                <Card key={summary.id} className="border border-blue-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{summary.className || `Class ${summary.classId}`}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Last updated: {summary.lastUpdated.toLocaleDateString()}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Class Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{summary.totalStudents}</p>
                        <p className="text-xs text-muted-foreground">Students</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{summary.averageCompletionRate}%</p>
                        <p className="text-xs text-muted-foreground">Avg. Progress</p>
                      </div>
                    </div>

                    {/* Performance Distribution */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Performance Distribution:</p>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        <div>
                          <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                            {summary.performanceDistribution.blooming} Blooming
                          </Badge>
                        </div>
                        <div>
                          <Badge className="bg-lime-100 text-lime-700 text-xs">
                            {summary.performanceDistribution.sprout} Sprout
                          </Badge>
                        </div>
                        <div>
                          <Badge className="bg-amber-100 text-amber-700 text-xs">
                            {summary.performanceDistribution.seedling} Seedling
                          </Badge>
                        </div>
                        <div>
                          <Badge className="bg-slate-100 text-slate-700 text-xs">
                            {summary.performanceDistribution.seed} Seed
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Recent Activity (7 days):</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {summary.recentActivity.newSubmissions} new submissions
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {summary.recentActivity.averageStudyTime} min avg study time
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}


      {/* No Data Message */}
      {!loading && ownChildrenData.length === 0 && classSummaries.length === 0 && allKindergartenStudents.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              <Sprout className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No Garden Data Available</p>
              <p className="text-sm mb-4">
                Your children's garden data will appear here once they have assignments and submissions.
              </p>
              <div className="text-xs space-y-1">
                <p>This could mean:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your children haven't been assigned to any classes yet</li>
                  <li>No assignments have been created for their classes</li>
                  <li>No assignments have been submitted yet</li>
                  <li>Class summaries haven't been generated yet</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Data for Current View */}
      {!loading && showWholeGarden && allKindergartenStudents.length === 0 && ownChildrenData.length > 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <div className="text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <p className="text-lg font-medium">No Other Students Found</p>
              <p className="text-sm">
                Your children are the only students in their classes, or no other students have data yet.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// Helper functions
function getStageLabel(stage: string): string {
  switch (stage) {
    case 'blooming': return 'Blooming';
    case 'sprout': return 'Sprout';
    case 'seedling': return 'Seedling';
    case 'seed': return 'Seed';
    default: return 'Unknown';
  }
}

function getStageBadgeClass(stage: string): string {
  switch (stage) {
    case 'blooming': return 'bg-emerald-100 text-emerald-700';
    case 'sprout': return 'bg-lime-100 text-lime-700';
    case 'seedling': return 'bg-amber-100 text-amber-700';
    case 'seed': return 'bg-slate-100 text-slate-700';
    default: return 'bg-gray-100 text-gray-700';
  }
}
