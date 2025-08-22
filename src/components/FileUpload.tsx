import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { X, Upload, Camera, Video, Mic, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { StorageService } from "@/lib/services/storage";

interface FileUploadProps {
  onFilesUploaded: (files: Array<{ url: string; type: string; filename: string }>) => void;
  maxFiles?: number;
  acceptedTypes?: string[];
  className?: string;
}

export const FileUpload = ({ 
  onFilesUploaded, 
  maxFiles = 5, 
  acceptedTypes = ['image/*', 'video/*', 'audio/*'],
  className 
}: FileUploadProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    if (files.length + selectedFiles.length > maxFiles) {
      toast({
        title: "Too Many Files",
        description: `You can only upload up to ${maxFiles} files.`,
        variant: "destructive"
      });
      return;
    }

    setFiles(prev => [...prev, ...selectedFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      const uploadPromises = files.map(async (file, index) => {
        const fileName = `${Date.now()}_${index}_${file.name}`;
        const filePath = `homework-submissions/${fileName}`;
        
        const url = await StorageService.uploadFile(file, filePath, {
          contentType: file.type,
          customMetadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString()
          }
        });

        return {
          url,
          type: file.type,
          filename: file.name
        };
      });

      const uploadedFiles = await Promise.all(uploadPromises);
      onFilesUploaded(uploadedFiles);
      
      setFiles([]);
      toast({
        title: "Upload Successful!",
        description: `${files.length} file(s) uploaded successfully.`,
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: "There was an error uploading your files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Camera className="h-4 w-4" />;
    if (file.type.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (file.type.startsWith('audio/')) return <Mic className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Upload className="h-5 w-5" />
          <span>Upload Homework Files</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* File Input */}
        <div className="space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedTypes.join(',')}
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="outline"
            className="w-full h-20 border-dashed border-2"
            disabled={uploading || files.length >= maxFiles}
          >
            <div className="flex flex-col items-center space-y-2">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {files.length >= maxFiles 
                  ? `Maximum ${maxFiles} files reached` 
                  : "Click to select files or drag and drop"
                }
              </span>
            </div>
          </Button>
        </div>

        {/* Selected Files */}
        {files.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                Selected Files ({files.length}/{maxFiles})
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFiles([])}
                disabled={uploading}
              >
                Clear All
              </Button>
            </div>
            
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {files.map((file, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 bg-muted rounded-lg">
                  {getFileIcon(file)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    disabled={uploading}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} className="w-full" />
          </div>
        )}

        {/* Upload Button */}
        {files.length > 0 && !uploading && (
          <Button
            onClick={uploadFiles}
            className="w-full"
            size="lg"
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload {files.length} File{files.length !== 1 ? 's' : ''}
          </Button>
        )}

        {/* File Type Info */}
        <div className="text-xs text-muted-foreground text-center">
          Supported formats: Images (JPG, PNG), Videos (MP4, MOV), Audio (MP3, WAV)
        </div>
      </CardContent>
    </Card>
  );
};


