import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  File, 
  Download, 
  Eye, 
  Image, 
  FileText, 
  Video, 
  Headphones, 
  Archive, 
  X,
  ExternalLink,
  Maximize2
} from 'lucide-react';
import { FileAttachment } from '@/lib/types';

interface FileViewerProps {
  files: FileAttachment[];
  title?: string;
  showDownloadButton?: boolean;
  showPreviewButton?: boolean;
  compact?: boolean;
}

export const FileViewer: React.FC<FileViewerProps> = ({
  files,
  title = "Attachments",
  showDownloadButton = true,
  showPreviewButton = true,
  compact = false
}) => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<FileAttachment | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  if (!files || files.length === 0) {
    return null;
  }

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.startsWith('video/')) return <Video className="h-4 w-4" />;
    if (type.startsWith('audio/')) return <Headphones className="h-4 w-4" />;
    if (type.includes('pdf') || type.includes('document')) return <FileText className="h-4 w-4" />;
    if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return <Archive className="h-4 w-4" />;
    
    return <File className="h-4 w-4" />;
  };

  const getFileTypeLabel = (fileType: string) => {
    const type = fileType.toLowerCase();
    
    if (type.startsWith('image/')) return 'Image';
    if (type.startsWith('video/')) return 'Video';
    if (type.startsWith('audio/')) return 'Audio';
    if (type.includes('pdf')) return 'PDF';
    if (type.includes('document') || type.includes('word')) return 'Document';
    if (type.includes('spreadsheet') || type.includes('excel')) return 'Spreadsheet';
    if (type.includes('presentation') || type.includes('powerpoint')) return 'Presentation';
    if (type.includes('zip') || type.includes('rar') || type.includes('tar')) return 'Archive';
    
    return 'File';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = async (file: FileAttachment) => {
    try {
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      link.target = '_blank';
      
      // Append to body, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({
        title: "Download started",
        description: `${file.name} is being downloaded.`,
      });
    } catch (error) {
      console.error('Download error:', error);
      toast({
        title: "Download failed",
        description: "Failed to download the file. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handlePreview = (file: FileAttachment) => {
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  const canPreview = (fileType: string) => {
    const type = fileType.toLowerCase();
    return type.startsWith('image/') || 
           type.startsWith('video/') || 
           type.startsWith('audio/') || 
           type.includes('pdf') ||
           type.includes('text/');
  };

  const renderFilePreview = (file: FileAttachment) => {
    const type = file.type.toLowerCase();
    
    if (type.startsWith('image/')) {
      return (
        <div className="flex justify-center">
          <img 
            src={file.url} 
            alt={file.name}
            className="max-w-full max-h-[70vh] object-contain rounded-lg"
            onError={(e) => {
              e.currentTarget.src = '/placeholder.svg';
              e.currentTarget.alt = 'Image failed to load';
            }}
          />
        </div>
      );
    }
    
    if (type.startsWith('video/')) {
      return (
        <div className="flex justify-center">
          <video 
            controls 
            className="max-w-full max-h-[70vh] rounded-lg"
            onError={(e) => {
              console.error('Video failed to load:', e);
            }}
          >
            <source src={file.url} type={file.type} />
            Your browser does not support the video tag.
          </video>
        </div>
      );
    }
    
    if (type.startsWith('audio/')) {
      return (
        <div className="flex justify-center">
          <audio 
            controls 
            className="w-full max-w-md"
            onError={(e) => {
              console.error('Audio failed to load:', e);
            }}
          >
            <source src={file.url} type={file.type} />
            Your browser does not support the audio tag.
          </audio>
        </div>
      );
    }
    
    if (type.includes('pdf')) {
      return (
        <div className="w-full h-[70vh]">
          <iframe
            src={`${file.url}#toolbar=1&navpanes=1&scrollbar=1`}
            className="w-full h-full border rounded-lg"
            title={file.name}
            onError={(e) => {
              console.error('PDF failed to load:', e);
            }}
          />
        </div>
      );
    }
    
    if (type.startsWith('text/')) {
      return (
        <div className="w-full h-[70vh] overflow-auto">
          <iframe
            src={file.url}
            className="w-full h-full border rounded-lg"
            title={file.name}
            onError={(e) => {
              console.error('Text file failed to load:', e);
            }}
          />
        </div>
      );
    }
    
    // For other file types, show a message with download option
    return (
      <div className="text-center py-12">
        <File className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-lg font-medium mb-2">Preview not available</h3>
        <p className="text-muted-foreground mb-4">
          This file type cannot be previewed. Please download to view.
        </p>
        <Button onClick={() => handleDownload(file)}>
          <Download className="h-4 w-4 mr-2" />
          Download {file.name}
        </Button>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground">{title}</h4>
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <div key={file.id} className="flex items-center space-x-2 bg-muted/50 rounded-lg px-3 py-2">
              {getFileIcon(file.type)}
              <span className="text-sm truncate max-w-32">{file.name}</span>
              {showDownloadButton && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(file)}
                  className="h-6 w-6 p-0 hover:bg-muted"
                >
                  <Download className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">{title} ({files.length})</h4>
      </div>
      
      <div className="grid gap-3">
        {files.map((file) => (
          <Card key={file.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-xs">
                        {getFileTypeLabel(file.type)}
                      </Badge>
                      <span>{formatFileSize(file.size)}</span>
                      <span>•</span>
                      <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {showPreviewButton && canPreview(file.type) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePreview(file)}
                      className="flex items-center space-x-2"
                    >
                      <Eye className="h-4 w-4" />
                      <span>Preview</span>
                    </Button>
                  )}
                  
                  {showDownloadButton && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownload(file)}
                      className="flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download</span>
                    </Button>
                  )}
                  
                  {!canPreview(file.type) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(file.url, '_blank')}
                      className="flex items-center space-x-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>Open</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* File Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center space-x-2">
                {getFileIcon(selectedFile?.type || '')}
                <span>{selectedFile?.name}</span>
              </DialogTitle>
              <div className="flex items-center space-x-2">
                {selectedFile && showDownloadButton && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(selectedFile)}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsPreviewOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto">
            {selectedFile && renderFilePreview(selectedFile)}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
