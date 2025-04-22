import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { VideoPlayer } from "@/components/VideoPlayer";
import { JobStatus } from "@/components/JobStatus";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ChevronLeft, Film, Play } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface VideoProps {
  id?: string;
}

export default function Video({ params = 0 }: VideoProps) {
  const videoId = params.id;

  if (isNaN(videoId)) {
    console.log("params", params);
    return <div className="py-8 text-center">Invalid video ID</div>;
  }
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [selectedResolutions, setSelectedResolutions] = useState<string[]>([
    "720p",
  ]);

  // Define the type for the video object
  type VideoType = {
    uploadName: string;
    category: string;
    fileSize: number;
    createdAt: string;
    status: string;
    folderName?: string;
    // add other properties as needed
  };

  // Fetch video details
  const {
    data: video,
    isLoading,
    error,
  } = useQuery<VideoType>({
    queryKey: [`/api/uploads/${videoId}`],
  });

  console.log("video", video);
  // Create HLS conversion job mutation
  const convertMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/job/hls/create", {
        uploadId: parseInt(videoId, 10),
        resolutions: selectedResolutions,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`/api/job/hls/getConversionJobs?uploadId=${videoId}`],
      });
      toast({
        title: "Conversion job created",
        description: "The video is now being converted to HLS format.",
        variant: "default",
      });
      setConvertDialogOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Conversion failed",
        description:
          error.message || "There was an error starting the conversion job.",
        variant: "destructive",
      });
    },
  });

  const toggleResolution = (resolution: string) => {
    if (selectedResolutions.includes(resolution)) {
      setSelectedResolutions(
        selectedResolutions.filter((r) => r !== resolution),
      );
    } else {
      setSelectedResolutions([...selectedResolutions, resolution]);
    }
  };

  if (isLoading) {
    return <div className="py-8 text-center">Loading video...</div>;
  }

  if (error || !video) {
    return (
      <div className="py-8 text-center text-red-500">
        Error loading video: {(error as Error)?.message || "Video not found"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Video Header */}
      <div className="flex items-center space-x-2">
        <Link href="/videos">
          <Button variant="outline" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-medium">{video.uploadName}</h1>
      </div>

      {/* Video Player and Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <VideoPlayer src={`/api/stream/${videoId}`} />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-medium mb-3">Video Information</h2>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Category:</dt>
                <dd>{video.category}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Size:</dt>
                <dd>{(video.fileSize / (1024 * 1024)).toFixed(2)} MB</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Uploaded:</dt>
                <dd>{new Date(video.createdAt).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Status:</dt>
                <dd>{video.status}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-muted-foreground">Folder:</dt>
                <dd>{video.folderName || "Uncategorized"}</dd>
              </div>
            </dl>

            <div className="mt-4 pt-4 border-t">
              <Button
                onClick={() => setConvertDialogOpen(true)}
                className="w-full"
              >
                <Film className="mr-2 h-4 w-4" /> Convert to HLS
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Conversion Jobs */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-medium mb-4">Conversion Jobs</h2>
        <JobStatus uploadId={videoId} />
      </div>

      {/* Convert Dialog */}
      <Dialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Video to HLS</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select which resolutions you want to convert this video to. Higher
              resolutions will require more processing time.
            </p>

            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resolution-1080p"
                  checked={selectedResolutions.includes("1080p")}
                  onCheckedChange={() => toggleResolution("1080p")}
                />
                <Label htmlFor="resolution-1080p">1080p (Full HD)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resolution-720p"
                  checked={selectedResolutions.includes("720p")}
                  onCheckedChange={() => toggleResolution("720p")}
                />
                <Label htmlFor="resolution-720p">720p (HD)</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="resolution-360p"
                  checked={selectedResolutions.includes("360p")}
                  onCheckedChange={() => toggleResolution("360p")}
                />
                <Label htmlFor="resolution-360p">360p (SD)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConvertDialogOpen(false)}
              disabled={convertMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => convertMutation.mutate()}
              disabled={
                selectedResolutions.length === 0 || convertMutation.isPending
              }
            >
              {convertMutation.isPending
                ? "Starting conversion..."
                : "Start Conversion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}