import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { JobStatus } from '@/components/JobStatus';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Jobs() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Parse file query parameter from URL if present
  const urlParams = new URLSearchParams(window.location.search);
  const fileId = urlParams.get('file');
  
  // Fetch all jobs
  const { data: jobs = [], isLoading, error } = useQuery({
    queryKey: [fileId 
      ? `/api/job/hls/getConversionJobs?uploadId=${fileId}` 
      : `/api/job/hls/all?status=${statusFilter}`
    ],
  });
  
  // Filter jobs by status if needed
  const filteredJobs = statusFilter === 'all' 
    ? jobs 
    : jobs.filter((job: any) => job.status === statusFilter);

  return (
    <div className="space-y-6">
      {/* Jobs Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-medium">Conversion Jobs</h1>
        
        {fileId ? (
          <div className="mt-2 md:mt-0 text-muted-foreground">
            Showing jobs for file #{fileId}
          </div>
        ) : (
          <div className="mt-2 md:mt-0">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="waiting">Waiting</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="ready">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Jobs Tabs */}
      {!fileId && (
        <Tabs defaultValue="all" onValueChange={setStatusFilter} value={statusFilter}>
          <TabsList className="grid grid-cols-4 w-full md:w-[400px]">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="processing">Active</TabsTrigger>
            <TabsTrigger value="ready">Completed</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Jobs List */}
      <div className="space-y-6">
        {isLoading ? (
          <div className="py-8 text-center">Loading jobs...</div>
        ) : error ? (
          <div className="py-8 text-center text-red-500">
            Error loading jobs: {(error as Error).message}
          </div>
        ) : filteredJobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <p className="text-muted-foreground">No conversion jobs found.</p>
            {statusFilter !== 'all' && (
              <p className="text-sm text-muted-foreground mt-2">
                Try changing the status filter to see other jobs.
              </p>
            )}
          </div>
        ) : (
          <JobStatus />
        )}
      </div>
    </div>
  );
}
