import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Square, Clock, Target, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface StudyTimeTrackerProps {
  assignmentId: string;
  assignmentTitle: string;
  estimatedTime: number; // in minutes
  onTimeComplete: (minutes: number) => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

const LIMIT_MINUTES = 60; // Maximum 60 minutes per session

export const StudyTimeTracker: React.FC<StudyTimeTrackerProps> = ({
  assignmentId,
  assignmentTitle,
  estimatedTime,
  onTimeComplete,
  isMinimized = false,
  onToggleMinimize
}) => {
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState(0);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Load state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem(`study_tracker_${assignmentId}`);
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.isRunning && state.startTime) {
          const now = Date.now();
          const elapsed = Math.floor((now - state.startTime) / 1000);
          const totalElapsed = Math.min(state.elapsedBefore + elapsed, LIMIT_MINUTES * 60);
          
          if (totalElapsed < LIMIT_MINUTES * 60) {
            setElapsedSeconds(totalElapsed);
            setIsRunning(true);
            startTimeRef.current = state.startTime;
            setPausedTime(state.pausedTime || 0);
          } else {
            // Time limit reached, auto-complete
            handleComplete();
          }
        } else {
          setElapsedSeconds(state.elapsedBefore || 0);
          setPausedTime(state.pausedTime || 0);
        }
      } catch (error) {
        console.error('Error loading study tracker state:', error);
      }
    }
  }, [assignmentId]);

  // Save state to localStorage
  const saveState = () => {
    const state = {
      isRunning,
      startTime: startTimeRef.current,
      elapsedBefore: elapsedSeconds,
      pausedTime,
      assignmentId,
      assignmentTitle
    };
    localStorage.setItem(`study_tracker_${assignmentId}`, JSON.stringify(state));
  };

  // Timer effect
  useEffect(() => {
    if (isRunning && !isPaused) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds(prev => {
          const newElapsed = prev + 1;
          if (newElapsed >= LIMIT_MINUTES * 60) {
            handleComplete();
            return prev;
          }
          return newElapsed;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isPaused]);

  // Save state whenever it changes
  useEffect(() => {
    saveState();
  }, [isRunning, elapsedSeconds, isPaused, pausedTime]);

  const startTimer = () => {
    if (elapsedSeconds >= LIMIT_MINUTES * 60) {
      toast({
        title: "Time limit reached",
        description: "You've reached the maximum time limit for this session.",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(true);
    setIsPaused(false);
    startTimeRef.current = Date.now();
    
    toast({
      title: "Timer started",
      description: `Started working on "${assignmentTitle}"`,
    });
  };

  const pauseTimer = () => {
    setIsPaused(true);
    setPausedTime(elapsedSeconds);
    toast({
      title: "Timer paused",
      description: "Your study session has been paused.",
    });
  };

  const resumeTimer = () => {
    setIsPaused(false);
    setPausedTime(0);
    toast({
      title: "Timer resumed",
      description: "Your study session has resumed.",
    });
  };

  const stopTimer = () => {
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setPausedTime(0);
    startTimeRef.current = null;
    
    toast({
      title: "Timer stopped",
      description: "Study session has been stopped.",
    });
  };

  const handleComplete = () => {
    const totalMinutes = Math.ceil(elapsedSeconds / 60);
    onTimeComplete(totalMinutes);
    
    // Reset timer
    setIsRunning(false);
    setIsPaused(false);
    setElapsedSeconds(0);
    setPausedTime(0);
    startTimeRef.current = null;
    
    // Clear localStorage
    localStorage.removeItem(`study_tracker_${assignmentId}`);
    
    toast({
      title: "🎉 Assignment completed!",
      description: `Great job! You spent ${totalMinutes} minutes on this assignment.`,
    });
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const progressPercentage = (elapsedSeconds / (LIMIT_MINUTES * 60)) * 100;
  const elapsedMinutes = Math.ceil(elapsedSeconds / 60);

  if (isMinimized) {
    return (
      <Card className="fixed bottom-4 right-4 w-80 z-50 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium truncate">
              {assignmentTitle}
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleMinimize}
              className="h-6 w-6 p-0"
            >
              <Target className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm">
            <span className="font-mono">{formatTime(elapsedSeconds)}</span>
            <div className="flex gap-1">
              {!isRunning ? (
                <Button size="sm" onClick={startTimer} disabled={elapsedSeconds >= LIMIT_MINUTES * 60} className="bg-green-600 hover:bg-green-700 text-white">
                  Start
                </Button>
              ) : isPaused ? (
                <Button size="sm" onClick={resumeTimer} className="bg-green-600 hover:bg-green-700 text-white">
                  Resume
                </Button>
              ) : (
                <Button size="sm" onClick={pauseTimer} className="bg-green-600 hover:bg-green-700 text-white">
                  Pause
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={stopTimer}>
                <Square className="h-3 w-3" />
              </Button>
            </div>
          </div>
          <Progress value={progressPercentage} className="mt-2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Study Timer
          <Badge variant="secondary" className="ml-auto">
            {assignmentTitle}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Time Display */}
          <div className="text-center">
            <div className="text-4xl font-mono font-bold text-primary">
              {formatTime(elapsedSeconds)}
            </div>
            <div className="text-sm text-muted-foreground mt-1">
              {elapsedMinutes} of {LIMIT_MINUTES} minutes
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Controls */}
          <div className="flex gap-2 justify-center">
            {!isRunning ? (
              <Button 
                onClick={startTimer} 
                disabled={elapsedSeconds >= LIMIT_MINUTES * 60}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            ) : isPaused ? (
              <Button onClick={resumeTimer} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                <Play className="h-4 w-4 mr-2" />
                Resume
              </Button>
            ) : (
              <Button onClick={pauseTimer} className="flex-1 bg-green-600 hover:bg-green-700 text-white">
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}
            
            <Button variant="outline" onClick={stopTimer}>
              <Square className="h-4 w-4 mr-2" />
              Stop
            </Button>
          </div>

          {/* Completion Button */}
          <Button 
            onClick={handleComplete}
            className="w-full"
            variant="default"
            disabled={elapsedSeconds === 0}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Mark Complete
          </Button>

          {/* Minimize Button */}
          {onToggleMinimize && (
            <Button 
              variant="ghost" 
              onClick={onToggleMinimize}
              className="w-full"
            >
              Minimize Timer
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
