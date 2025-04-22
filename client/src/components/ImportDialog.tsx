import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Folder, fileCategories } from "@shared/schema";

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportResponse {
  success: boolean;
  upload: {
    id: number;
    fileType: string;
    externalFileId: string;
    source: string;
    fileId: number;
    fileSize: number;
    uploadName: string;
    category: string;
    folderId: string | null;
    status: string;
    identifier: string;
    createdAt: string;
    updatedAt: string;
  };
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [fileId, setFileId] = useState("");
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState("");
  const [folderId, setFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch folders for dropdown
  // const { data: folders = [], isLoading: foldersLoading } = useQuery<Folder[]>({
  //   queryKey: ["/api/folders"],
  //   queryFn: async () => {
  //     const response = await apiRequest("GET", "/api/folders");
  //     return response.json();
  //   },
  //   enabled: isOpen, // Only fetch when modal is open
  //   staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  // });
  const {
    data: folders = [],
    isLoading: foldersLoading,
    error,
  } = useQuery<Folder[]>({
    queryKey: [`/api/folders/`],
    enabled: isOpen,
  });

  // Mutation to create a new folder
  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("POST", "/api/folders", { name });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/folders"] });
      toast({
        title: "Folder created",
        description: "The new folder has been created successfully.",
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create folder",
        description: error.message || "There was an error creating the folder.",
        variant: "destructive",
      });
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      // Construct query string from parameters
      const queryParams = new URLSearchParams({
        fileType: category==='video' ? 'video/mp4': 'text',
        fileId,
        uploadName: fileName,
        category,
        folderId,
      }).toString();

      const response = await apiRequest(
        "GET",
        `/api/upload/googledrive?${queryParams}`
      );
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uploads"] });
      toast({
        title: "File imported successfully",
        description: "The file has been imported from Google Drive.",
        variant: "default",
      });

      // Close dialog and reset form
      onClose();
      setFileId("");
      setFileName("");
      setCategory("");
      setFolderId("");
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description:
          error.message ||
          "There was an error importing the file from Google Drive.",
        variant: "destructive",
      });
    },
  });

  const handleImport = () => {
    if (!fileId) {
      toast({
        title: "File ID required",
        description: "Please enter a Google Drive file ID.",
        variant: "destructive",
      });
      return;
    }

    if (!fileName) {
      toast({
        title: "File name required",
        description: "Please enter a name for the file.",
        variant: "destructive",
      });
      return;
    }

    if (!category) {
      toast({
        title: "Category required",
        description: "Please select a category for the file.",
        variant: "destructive",
      });
      return;
    }

    importMutation.mutate();
  };

  const handleFolderChange = (value: string) => {
    if (value === "new") {
      // Prompt for new folder name
      const name = prompt("Enter new folder name:");
      if (name) {
        setNewFolderName(name);
        createFolderMutation.mutate(name, {
          onSuccess: (newFolder: Folder) => {
            setFolderId(newFolder.id.toString());
          },
        });
      }
    } else {
      setFolderId(value);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Import from Google Drive</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fileId">Google Drive File ID</Label>
            <Input
              id="fileId"
              value={fileId}
              onChange={(e) => setFileId(e.target.value)}
              placeholder="Enter Google Drive file ID"
              disabled={importMutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              The file ID is the part of the URL after
              "https://drive.google.com/file/d/" and before "/view"
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fileName">File Name</Label>
            <Input
              id="fileName"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Enter file name"
              disabled={importMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={category}
              onValueChange={setCategory}
              disabled={importMutation.isPending}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {fileCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder">Folder</Label>
            <Select
              value={folderId}
              onValueChange={handleFolderChange}
              disabled={importMutation.isPending || foldersLoading}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    foldersLoading ? "Loading folders..." : "Select folder"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id.toString()}>
                    {folder.name}
                  </SelectItem>
                ))}
                <SelectItem value="new">+ Create New Folder</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={importMutation.isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={importMutation.isPending}>
            {importMutation.isPending ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
