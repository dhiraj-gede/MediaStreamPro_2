import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { X, UploadCloud } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CHUNK_SIZE } from '@/lib/constants';

interface FileUploaderProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SelectedFile {
  file: File;
  id: string;
  progress: number;
  status: 'waiting' | 'uploading' | 'success' | 'error';
  error?: string;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ isOpen, onClose }) => {
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [category, setCategory] = useState<string>('');
  const [folder, setFolder] = useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch folders for dropdown
  const { data: folders = [] } = useQuery({
    queryKey: ['/api/folders'],
    initialData: []
  });

  // Handle file drop
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = acceptedFiles.map(file => ({
      file,
      id: `${Date.now()}-${file.name}`,
      progress: 0,
      status: 'waiting' as const
    }));
    
    setSelectedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxSize: 1024 * 1024 * 1024, // 1GB
    accept: {
      'video/mp4': ['.mp4'],
      'video/x-matroska': ['.mkv'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'application/pdf': ['.pdf'],
      'application/zip': ['.zip']
    }
  });

  // Remove file from selection
  const removeFile = (id: string) => {
    setSelectedFiles(prev => prev.filter(file => file.id !== id));
  };

  // Upload a file in chunks
  const uploadFile = async (selectedFile: SelectedFile) => {
    try {
      const file = selectedFile.file;
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      
      // Update file status
      setSelectedFiles(prev => 
        prev.map(f => f.id === selectedFile.id ? { ...f, status: 'uploading' } : f)
      );
      
      // Create form data for initial creation
      const formData = new FormData();
      formData.append('category', category);
      formData.append('folderName', folder);
      formData.append('fileName', file.name);
      formData.append('fileSize', file.size.toString());
      formData.append('fileType', file.type);
      formData.append('totalChunks', totalChunks.toString());
      
      // Create initial upload record
      const initResponse = await apiRequest('POST', '/api/upload/init', {
        category,
        folderName: folder,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        totalChunks
      });
      
      const { uploadId } = await initResponse.json();
      
      // Upload each chunk
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const chunk = file.slice(start, end);
        
        const chunkForm = new FormData();
        chunkForm.append('chunk', chunk);
        chunkForm.append('uploadId', uploadId);
        chunkForm.append('chunkIndex', i.toString());
        
        await fetch('/api/upload/chunk', {
          method: 'POST',
          body: chunkForm,
        });
        
        // Update progress
        const progress = Math.round(((i + 1) / totalChunks) * 100);
        setSelectedFiles(prev => 
          prev.map(f => f.id === selectedFile.id ? { ...f, progress } : f)
        );
      }
      
      // Complete the upload
      await apiRequest('POST', '/api/upload/complete', {
        uploadId
      });
      
      // Update status to success
      setSelectedFiles(prev => 
        prev.map(f => f.id === selectedFile.id ? { ...f, status: 'success', progress: 100 } : f)
      );
      
      return uploadId;
    } catch (error: any) {
      console.error('Upload error:', error);
      setSelectedFiles(prev => 
        prev.map(f => f.id === selectedFile.id ? { 
          ...f, 
          status: 'error', 
          error: error.message || 'Upload failed' 
        } : f)
      );
      throw error;
    }
  };

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      const uploadPromises = selectedFiles
        .filter(f => f.status === 'waiting')
        .map(uploadFile);
      
      return Promise.all(uploadPromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/uploads'] });
      toast({
        title: 'Files uploaded successfully',
        description: 'Your files have been uploaded and are being processed.',
        variant: 'success'
      });
      
      // Close the dialog after 1 second to show the success state
      setTimeout(() => {
        onClose();
        setSelectedFiles([]);
        setCategory('');
        setFolder('');
      }, 1000);
    },
    onError: (error: any) => {
      toast({
        title: 'Upload failed',
        description: error.message || 'There was an error uploading your files.',
        variant: 'destructive'
      });
    }
  });

  const handleUpload = () => {
    if (!category) {
      toast({
        title: 'Category required',
        description: 'Please select a category for your files.',
        variant: 'destructive'
      });
      return;
    }
    
    if (selectedFiles.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select at least one file to upload.',
        variant: 'destructive'
      });
      return;
    }
    
    uploadMutation.mutate();
  };

  const isUploading = uploadMutation.isPending || selectedFiles.some(f => f.status === 'uploading');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[625px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
        </DialogHeader>
        
        <div className="overflow-y-auto flex-1 py-2">
          <div 
            {...getRootProps()} 
            className={`border-2 border-dashed rounded-lg p-8 mb-6 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300'}`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center">
              <UploadCloud className="h-12 w-12 text-gray-400 mb-3" />
              <p className="mb-2 text-lg text-gray-600">Drag and drop files here</p>
              <p className="text-sm text-gray-500 mb-4">or</p>
              <Button>Browse Files</Button>
              <p className="mt-4 text-xs text-gray-500">
                Supported files: Videos (MP4, MKV), Images (JPG, PNG), Documents (PDF), Code (ZIP)<br />
                Maximum file size: 1GB
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="code">Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="folder">Folder</Label>
              <Select value={folder} onValueChange={setFolder}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((folder: any) => (
                    <SelectItem key={folder.id} value={folder.id.toString()}>
                      {folder.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="new">+ Create New Folder</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="border-t pt-4 mt-4">
            <h4 className="font-medium mb-2">Selected Files</h4>
            {selectedFiles.length === 0 ? (
              <div className="text-center py-4 text-gray-500 text-sm">
                No files selected
              </div>
            ) : (
              <div className="space-y-3">
                {selectedFiles.map((file) => (
                  <div key={file.id} className="border rounded-lg p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center">
                        <div className="w-10 h-10 mr-3 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center">
                          <span className="text-muted-foreground">insert_drive_file</span>
                        </div>
                        <div>
                          <div className="font-medium">{file.file.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {(file.file.size / (1024 * 1024)).toFixed(2)} MB
                          </div>
                        </div>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeFile(file.id)}
                        disabled={file.status === 'uploading'}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span>
                          {file.status === 'waiting' && 'Ready to upload'}
                          {file.status === 'uploading' && 'Uploading...'}
                          {file.status === 'success' && 'Uploaded successfully'}
                          {file.status === 'error' && (file.error || 'Upload failed')}
                        </span>
                        <span>{file.progress}%</span>
                      </div>
                      <Progress value={file.progress} className="h-1.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <DialogFooter className="flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpload} 
            disabled={selectedFiles.length === 0 || !category || isUploading}
          >
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
