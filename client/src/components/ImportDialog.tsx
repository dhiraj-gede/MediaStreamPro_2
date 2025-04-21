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

interface ImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const [fileId, setFileId] = useState("");
  const [fileName, setFileName] = useState("");
  const [category, setCategory] = useState("");
  const [folderId, setFolderId] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch folders for dropdown
  const { data: folders = [] } = useQuery({
    queryKey: ["/api/folders"],
    initialData: [],
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("GET", "/api/upload/googledrive", {
        fileId,
        uploadName: fileName,
        category,
        folderId,
      });
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
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
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

          <div className="space-y-2">
            <Label htmlFor="folder">Folder</Label>
            <Select value={folderId} onValueChange={setFolderId}>
              <SelectTrigger>
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
