import React, { useState } from 'react';
import { StorageUsage } from '@/components/StorageUsage';
import { FileList } from '@/components/FileList';
import { JobStatus } from '@/components/JobStatus';
import { FileUploader } from '@/components/FileUploader';
import { ImportDialog } from '@/components/ImportDialog';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { UploadCloud, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function Dashboard() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  // Fetch active conversion jobs
  const { data: activeJobs = [] } = useQuery({
    queryKey: ['/api/job/hls/active'],
    initialData: []
  });

  return (
    <div className="space-y-6">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-medium">Dashboard</h1>
        <div className="flex mt-4 md:mt-0 space-x-2">
          <Button onClick={() => setUploadDialogOpen(true)}>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Import
          </Button>
        </div>
      </div>

      {/* Storage Usage Summary */}
      <StorageUsage limit={3} />

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
          <h2 className="text-lg font-medium mb-2 md:mb-0">Recent Activity</h2>
          <div className="flex items-center">
            {/* Category and folder filters can be added here */}
          </div>
        </div>
        
        <FileList />
      </div>

      {/* Conversion Jobs */}
      {activeJobs.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
            <h2 className="text-lg font-medium mb-2 md:mb-0">Active Conversion Jobs</h2>
            <Link href="/jobs" className="text-primary hover:underline flex items-center">
              <span>View All Jobs</span>
              <span className="text-sm ml-1">chevron_right</span>
            </Link>
          </div>
          
          <JobStatus />
        </div>
      )}

      {/* File Upload Dialog */}
      <FileUploader isOpen={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} />

      {/* Import Dialog */}
      <ImportDialog isOpen={importDialogOpen} onClose={() => setImportDialogOpen(false)} />
    </div>
  );
}
