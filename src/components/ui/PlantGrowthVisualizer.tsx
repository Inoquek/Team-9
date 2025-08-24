import React from 'react';
import { Progress } from './progress';
import { Badge } from './badge';
import { Sprout, Circle, Flower, TreePine, Leaf, Apple, Sun, Droplets } from 'lucide-react';

interface PlantGrowthVisualizerProps {
  stage: 'seed' | 'germinating' | 'seedling' | 'growing' | 'sprout' | 'budding' | 'flowering' | 'blooming' | 'fruiting';
  completionRate: number;
  studentName: string;
  className?: string;
}

const stageConfig = {
  seed: {
    icon: Circle,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    borderColor: 'border-gray-300',
    label: 'Seed',
    description: 'Just starting out!',
    emoji: '🌱',
    minProgress: 0,
    maxProgress: 9
  },
  germinating: {
    icon: Sprout,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    borderColor: 'border-green-300',
    label: 'Germinating',
    description: 'Breaking through!',
    emoji: '🌱',
    minProgress: 10,
    maxProgress: 24
  },
  seedling: {
    icon: Sprout,
    color: 'text-green-700',
    bgColor: 'bg-green-200',
    borderColor: 'border-green-400',
    label: 'Seedling',
    description: 'Growing strong!',
    emoji: '🌿',
    minProgress: 25,
    maxProgress: 44
  },
  growing: {
    icon: Leaf,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-200',
    borderColor: 'border-emerald-400',
    label: 'Growing',
    description: 'Getting bigger!',
    emoji: '🌿',
    minProgress: 45,
    maxProgress: 59
  },
  sprout: {
    icon: TreePine,
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-300',
    borderColor: 'border-emerald-500',
    label: 'Sprout',
    description: 'Branching out!',
    emoji: '🌳',
    minProgress: 60,
    maxProgress: 69
  },
  budding: {
    icon: Flower,
    color: 'text-blue-600',
    bgColor: 'bg-blue-200',
    borderColor: 'border-blue-400',
    label: 'Budding',
    description: 'Preparing to bloom!',
    emoji: '🌺',
    minProgress: 70,
    maxProgress: 79
  },
  flowering: {
    icon: Flower,
    color: 'text-purple-600',
    bgColor: 'bg-purple-200',
    borderColor: 'border-purple-400',
    label: 'Flowering',
    description: 'Beautiful blooms!',
    emoji: '🌸',
    minProgress: 80,
    maxProgress: 89
  },
  blooming: {
    icon: Sun,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-200',
    borderColor: 'border-yellow-400',
    label: 'Blooming',
    description: 'Radiant beauty!',
    emoji: '🌻',
    minProgress: 90,
    maxProgress: 94
  },
  fruiting: {
    icon: Apple,
    color: 'text-red-600',
    bgColor: 'bg-red-200',
    borderColor: 'border-red-400',
    label: 'Fruiting',
    description: 'Bearing fruit!',
    emoji: '🍎',
    minProgress: 95,
    maxProgress: 100
  }
};

export const PlantGrowthVisualizer: React.FC<PlantGrowthVisualizerProps> = ({
  stage,
  completionRate,
  studentName,
  className = ''
}) => {
  const config = stageConfig[stage];
  const IconComponent = config.icon;
  
  // Calculate progress within the current stage
  const stageProgress = Math.min(
    Math.max(
      ((completionRate - config.minProgress) / (config.maxProgress - config.minProgress)) * 100,
      0
    ),
    100
  );

  // Calculate overall progress to next stage
  const nextStage = Object.values(stageConfig).find(s => s.minProgress > completionRate);
  const progressToNext = nextStage 
    ? Math.round(((completionRate - config.minProgress) / (nextStage.minProgress - config.minProgress)) * 100)
    : 100;

  return (
    <div className={`p-6 rounded-lg border-2 ${config.borderColor} ${config.bgColor} ${className}`}>
      {/* Plant Visualization */}
      <div className="text-center mb-4">
        <div className="relative inline-block">
          {/* Animated Plant Icon */}
          <div className={`text-6xl mb-2 animate-pulse ${config.color}`}>
            {config.emoji}
          </div>
          
          {/* Growth Particles */}
          <div className="absolute inset-0 flex items-center justify-center">
            {stageProgress > 50 && (
              <div className="animate-bounce">
                <Droplets className="h-4 w-4 text-blue-400" />
              </div>
            )}
          </div>
        </div>
        
        {/* Stage Label */}
        <div className="mb-2">
          <Badge className={`${config.bgColor} ${config.color} border ${config.borderColor}`}>
            {config.label}
          </Badge>
        </div>
        
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{studentName}'s Plant</h3>
        <p className="text-sm text-gray-600 mb-3">{config.description}</p>
      </div>

      {/* Progress Bars */}
      <div className="space-y-3">
        {/* Current Stage Progress */}
        <div>
          <div className="flex justify-between text-sm text-gray-700 mb-1">
            <span>Stage Progress</span>
            <span>{Math.round(stageProgress)}%</span>
          </div>
          <Progress 
            value={stageProgress} 
            className="h-2"
          />
          <p className="text-xs text-gray-500 mt-1">
            {completionRate}% complete • {config.label} stage
          </p>
        </div>

        {/* Progress to Next Stage */}
        {nextStage && (
          <div>
            <div className="flex justify-between text-sm text-gray-700 mb-1">
              <span>Next: {nextStage.label}</span>
              <span>{progressToNext}%</span>
            </div>
            <Progress 
              value={progressToNext} 
              className="h-2 bg-gray-200"
            />
            <p className="text-xs text-gray-500 mt-1">
              {nextStage.minProgress - completionRate}% more to reach {nextStage.label}
            </p>
          </div>
        )}

        {/* Overall Completion */}
        <div>
          <div className="flex justify-between text-sm text-gray-700 mb-1">
            <span>Overall Progress</span>
            <span>{completionRate}%</span>
          </div>
          <Progress 
            value={completionRate} 
            className="h-3"
          />
        </div>
      </div>

      {/* Growth Milestones */}
      <div className="mt-4 pt-3 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Growth Journey</h4>
        <div className="grid grid-cols-3 gap-2 text-xs">
          {Object.entries(stageConfig).map(([stageKey, stageInfo]) => (
            <div 
              key={stageKey}
              className={`text-center p-2 rounded ${
                stageKey === stage 
                  ? `${stageInfo.bgColor} ${stageInfo.color} border ${stageInfo.borderColor}`
                  : 'bg-gray-50 text-gray-400'
              }`}
            >
              <div className="text-lg mb-1">{stageInfo.emoji}</div>
              <div className="font-medium">{stageInfo.label}</div>
              <div className="text-xs">{stageInfo.minProgress}%+</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
