import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Brain, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { manualGenerateRecommendations } from './AIRecommendationScheduler';

interface AdminAIControlProps {
  availableClassIds?: string[];
}

export default function AdminAIControl({ availableClassIds = [] }: AdminAIControlProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [customClassId, setCustomClassId] = useState('');
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setResult(null);

    try {
      const classesToProcess = [
        ...selectedClasses,
        ...(customClassId.trim() ? [customClassId.trim()] : [])
      ];

      if (classesToProcess.length === 0) {
        setResult({ success: false, error: 'Please select at least one class' });
        return;
      }

      const response = await manualGenerateRecommendations(classesToProcess);
      setResult(response);
      
      if (response.success) {
        setSelectedClasses([]);
        setCustomClassId('');
      }
    } catch (error) {
      setResult({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleClassSelection = (classId: string) => {
    setSelectedClasses(prev => 
      prev.includes(classId) 
        ? prev.filter(id => id !== classId)
        : [...prev, classId]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          AI Recommendations Control Panel
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Available Classes */}
        {availableClassIds.length > 0 && (
          <div>
            <label className="text-sm font-medium mb-2 block">
              Select Classes:
            </label>
            <div className="flex flex-wrap gap-2">
              {availableClassIds.map(classId => (
                <Badge
                  key={classId}
                  variant={selectedClasses.includes(classId) ? "default" : "outline"}
                  className="cursor-pointer hover:bg-primary/20"
                  onClick={() => toggleClassSelection(classId)}
                >
                  {classId}
                </Badge>
              ))}
            </div>
          </div>
        )}
        
        {/* Custom Class ID */}
        <div>
          <label htmlFor="customClass" className="text-sm font-medium mb-2 block">
            Or Enter Class ID:
          </label>
          <Input
            id="customClass"
            value={customClassId}
            onChange={(e) => setCustomClassId(e.target.value)}
            placeholder="class-id-123"
            className="max-w-sm"
          />
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="w-full sm:w-auto"
        >
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Generating Recommendations...
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-2" />
              Generate AI Recommendations
            </>
          )}
        </Button>

        {/* Result Display */}
        {result && (
          <div className={`
            p-3 rounded-lg border flex items-center gap-2
            ${result.success 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
            }
          `}>
            {result.success ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <AlertCircle className="h-5 w-5" />
            )}
            <span className="text-sm">
              {result.success ? result.message : result.error}
            </span>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> This will generate personalized AI recommendations for all parents 
            in the selected classes. Each recommendation is tailored to individual student performance 
            and parent engagement patterns.
          </p>
          <p className="text-xs text-blue-600 mt-2">
            Cost: ~$0.28/month for 400 parents (DeepSeek API)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
