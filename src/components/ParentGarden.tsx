import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Sprout, Apple, Award, Users, TrendingUp, Clock, BookOpen } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { GardenService } from "@/lib/services/garden";
import type { ClassSummary, GardenStudentData, User } from "@/lib/types";

export const ParentGarden = () => {
  const { user } = useAuth() as { user: User };
  const [classSummaries, setClassSummaries] = useState<ClassSummary[]>([]);
  const [ownChildrenData, setOwnChildrenData] = useState<GardenStudentData[]>([]);
  const [loading, setLoading] = useState(true);

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
            Watch your children grow and see how their class is performing together.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

        <Card className="border-l-4 border-l-lime-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Sprout className="h-7 w-7 text-lime-600" />
              <div>
                <p className="text-2xl font-bold">{avgCompletionRate}%</p>
                <p className="text-sm text-muted-foreground">Average Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-yellow-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Award className="h-7 w-7 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{bloomingChildren}</p>
                <p className="text-sm text-muted-foreground">Blooming (≥90%)</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Children Section */}
      {ownChildrenData.length > 0 && (
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

      {/* Debug Information (remove in production) */}
      {process.env.NODE_ENV === 'development' && (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="text-orange-800">Debug Info</CardTitle>
          </CardHeader>
          <CardContent className="text-orange-700 text-sm">
            <p>Class Summaries: {classSummaries.length}</p>
            <p>Own Children: {ownChildrenData.length}</p>
            <p>Loading: {loading ? 'Yes' : 'No'}</p>
            {ownChildrenData.length > 0 && (
              <div className="mt-2">
                <p className="font-medium">Children Data:</p>
                {ownChildrenData.map(child => (
                  <div key={child.id} className="ml-2">
                    • {child.name}: {child.completionRate}% ({child.completedAssignments}/{child.totalAssignments})
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Data Message */}
      {!loading && ownChildrenData.length === 0 && classSummaries.length === 0 && (
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
