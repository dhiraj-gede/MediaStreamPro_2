import React, { useState } from 'react';
import { FileList } from '@/components/FileList';
import { FileUploader } from '@/components/FileUploader';
import { ImportDialog } from '@/components/ImportDialog';
import { Button } from '@/components/ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { UploadCloud, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function Videos() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('');
  
  // Fetch folders for dropdown
  const { data: folders = [] } = useQuery({
    queryKey: ['/api/folders'],
    initialData: []
  });

  return (
    <div className="space-y-6">
      {/* Videos Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-medium">Videos</h1>
        <div className="flex mt-4 md:mt-0 space-x-2">
          <Button onClick={() => setUploadDialogOpen(true)}>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload Video
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Import Video
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-1/3">
            <Select value={selectedFolder} onValueChange={setSelectedFolder}>
              <SelectTrigger>
                <SelectValue placeholder="All Folders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Folders</SelectItem>
                {folders.map((folder: any) => (
                  <SelectItem key={folder.id} value={folder.id.toString()}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Videos List */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <FileList 
          category="video"
          folderId={selectedFolder || undefined} 
        />
      </div>

      {/* File Upload Dialog */}
      <FileUploader isOpen={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} />

      {/* Import Dialog */}
      <ImportDialog isOpen={importDialogOpen} onClose={() => setImportDialogOpen(false)} />
    </div>
  );
}
