import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { X, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { formatDistance } from 'date-fns';

interface JobStatusProps {
  uploadId?: number;
  jobId?: number;
}

export const JobStatus: React.FC<JobStatusProps> = ({ uploadId, jobId }) => {
  // Fetch job data based on uploadId or jobId
  const { data: jobs = [], isLoading, error } = useQuery({
    queryKey: [uploadId ? `/api/job/hls/getConversionJobs?uploadId=${uploadId}` : `/api/job/hls/get?jobId=${jobId}`],
    enabled: !!uploadId || !!jobId
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading conversion job...</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Error loading conversion jobs</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500">{(error as Error).message}</p>
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No conversion jobs found</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No HLS conversion jobs have been created for this file.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job: any) => (
        <Card key={job.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between">
              <div className="flex items-center mb-2 md:mb-0">
                <div className="mr-3 bg-gray-100 rounded flex-shrink-0 flex items-center justify-center p-2">
                  <span className="text-muted-foreground">video_file</span>
                </div>
                <div>
                  <CardTitle className="text-base">{job.fileName || 'Video file'}</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    Converting to HLS {job.resolutions?.join(', ') || job.resolution}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <JobStatusBadge status={job.status} />
                <Button variant="ghost" size="icon" className="ml-2">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Overall Progress</span>
                  <span>{job.progress}%</span>
                </div>
                <Progress value={job.progress} className="h-2" />
              </div>
              
              {job.resolutions && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  {job.resolutionStatus?.map((res: any) => (
                    <div key={res.resolution}>
                      <div className="flex justify-between text-xs mb-1">
                        <span>{res.resolution}</span>
                        <span>
                          {res.status === 'ready' 
                            ? 'Complete' 
                            : res.status === 'processing' 
                              ? `${res.progress}%` 
                              : res.status}
                        </span>
                      </div>
                      <Progress 
                        value={res.status === 'ready' ? 100 : res.progress || 0} 
                        className="h-1.5" 
                      />
                    </div>
                  ))}
                </div>
              )}
              
              {job.startedAt && (
                <div className="text-xs text-muted-foreground mt-2">
                  Started {formatDistance(new Date(job.startedAt), new Date(), { addSuffix: true })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

const JobStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'waiting':
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-800">
          <Clock className="h-3.5 w-3.5 mr-1" />
          Waiting
        </Badge>
      );
    case 'processing':
      return (
        <Badge className="bg-yellow-100 text-yellow-800">
          <span className="mr-1">pending</span>
          Processing
        </Badge>
      );
    case 'ready':
      return (
        <Badge className="bg-green-100 text-green-800">
          <CheckCircle className="h-3.5 w-3.5 mr-1" />
          Complete
        </Badge>
      );
    case 'failed':
      return (
        <Badge className="bg-red-100 text-red-800">
          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
          Failed
        </Badge>
      );
    default:
      return (
        <Badge variant="outline">
          {status}
        </Badge>
      );
  }
};
