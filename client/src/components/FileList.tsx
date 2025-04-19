import React, { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MoreVertical, 
  Eye, 
  Download, 
  VideoIcon,
  ImageIcon,
  FileText,
  Archive,
  CheckCircle
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { FileCategory } from '@shared/schema';

interface FileListProps {
  category?: FileCategory;
  folderId?: string;
}

interface FileData {
  id: number;
  uploadName: string;
  fileType: string;
  fileSize: number;
  category: FileCategory;
  folderId?: string;
  folderName?: string;
  status: string;
  createdAt: string;
  thumbnail?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getCategoryIcon = (category: FileCategory) => {
  switch (category) {
    case 'video':
      return <VideoIcon className="h-5 w-5" />;
    case 'image':
      return <ImageIcon className="h-5 w-5" />;
    case 'document':
      return <FileText className="h-5 w-5" />;
    case 'code':
      return <Archive className="h-5 w-5" />;
    default:
      return <FileText className="h-5 w-5" />;
  }
};

const getCategoryColor = (category: FileCategory) => {
  switch (category) {
    case 'video':
      return 'bg-blue-100 text-blue-800';
    case 'image':
      return 'bg-green-100 text-green-800';
    case 'document':
      return 'bg-red-100 text-red-800';
    case 'code':
      return 'bg-purple-100 text-purple-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const FileList: React.FC<FileListProps> = ({ category, folderId }) => {
  const [page, setPage] = useState(1);
  const limit = 10;
  
  // Build query parameters
  const queryParams = new URLSearchParams();
  if (category) queryParams.append('category', category);
  if (folderId) queryParams.append('folderId', folderId);
  queryParams.append('page', page.toString());
  queryParams.append('limit', limit.toString());
  
  // Fetch files
  const { data, isLoading, error } = useQuery<{
    files: FileData[];
    total: number;
  }>({
    queryKey: [`/api/uploads?${queryParams.toString()}`],
  });

  const files = data?.files || [];
  const totalFiles = data?.total || 0;
  const totalPages = Math.ceil(totalFiles / limit);

  if (isLoading) {
    return <div className="py-8 text-center">Loading files...</div>;
  }
  
  if (error) {
    return <div className="py-8 text-center text-red-500">Error loading files: {(error as Error).message}</div>;
  }
  
  if (files.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 mb-4">No files found</p>
        <p className="text-sm text-gray-400">Upload a file to get started</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Folder</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {files.map((file) => (
              <TableRow key={file.id} className="hover:bg-gray-50">
                <TableCell>
                  <div className="flex items-center">
                    <div className="w-10 h-10 mr-3 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center">
                      {getCategoryIcon(file.category)}
                    </div>
                    <div>
                      <div className="font-medium">{file.uploadName}</div>
                      <div className="text-xs text-muted-foreground">{file.fileType}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={getCategoryColor(file.category)}>
                    {file.category.charAt(0).toUpperCase() + file.category.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell>{file.folderName || 'Uncategorized'}</TableCell>
                <TableCell className="text-muted-foreground">
                  {format(new Date(file.createdAt), 'PP')}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatBytes(file.fileSize)}
                </TableCell>
                <TableCell>
                  {file.status === 'processing' ? (
                    <div>
                      <span className="flex items-center text-xs font-medium text-yellow-600">
                        <span className="mr-1 text-sm">pending</span>
                        Processing
                      </span>
                      <Progress value={75} className="w-24 h-1.5 mt-1" />
                    </div>
                  ) : file.status === 'ready' ? (
                    <span className="flex items-center text-xs font-medium text-green-600">
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />
                      Ready
                    </span>
                  ) : (
                    <span className="flex items-center text-xs font-medium text-red-600">
                      <span className="mr-1 text-sm">error</span>
                      Failed
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-1">
                    {file.category === 'video' ? (
                      <Link href={`/video/${file.id}`}>
                        <Button variant="ghost" size="icon" title="View">
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </Link>
                    ) : (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        title="Download"
                        onClick={() => window.open(`/api/download/${file.id}`, '_blank')}
                      >
                        <Download className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Details</DropdownMenuItem>
                        <DropdownMenuItem>Download</DropdownMenuItem>
                        {file.category === 'video' && (
                          <DropdownMenuItem>
                            <Link href={`/jobs?file=${file.id}`}>View Conversion Jobs</Link>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {totalPages > 1 && (
        <div className="mt-4 flex justify-between items-center">
          <div className="text-sm text-muted-foreground">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalFiles)} of {totalFiles} files
          </div>
          <div className="flex space-x-1">
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <span className="text-muted-foreground">chevron_left</span>
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              disabled={page === totalPages}
              onClick={() => setPage(page + 1)}
            >
              <span className="text-muted-foreground">chevron_right</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
