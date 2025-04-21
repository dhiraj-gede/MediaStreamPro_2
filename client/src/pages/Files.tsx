import React, { useState } from "react";
import { FileList } from "@/components/FileList";
import { FileUploader } from "@/components/FileUploader";
import { ImportDialog } from "@/components/ImportDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UploadCloud, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export default function Files() {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>("all");
  const [selectedFolder, setSelectedFolder] = useState<string | undefined>("all");

  // Fetch folders for dropdown
  const { data: folders = [] } = useQuery({
    queryKey: ["/api/folders"],
    initialData: [],
  });

  return (
    <div className="space-y-6">
      {/* Files Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-medium">Files</h1>
        <div className="flex mt-4 md:mt-0 space-x-2">
          <Button onClick={() => setUploadDialogOpen(true)}>
            <UploadCloud className="mr-2 h-4 w-4" /> Upload
          </Button>
          <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" /> Import
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="w-full md:w-1/3">
            <Select
              value={selectedCategory}
              onValueChange={setSelectedCategory}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="video">Videos</SelectItem>
                <SelectItem value="image">Images</SelectItem>
                <SelectItem value="document">Documents</SelectItem>
                <SelectItem value="code">Code</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-full md:w-1/3">
            <Select value={selectedFolder} onValueChange={setSelectedFolder}>
              <SelectTrigger>
                <SelectValue placeholder="All Folders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Folders</SelectItem>
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

      {/* Files List */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <FileList
          category={
            selectedCategory !== "all"
              ? (selectedCategory as "code" | "video" | "image" | "document" | undefined)
              : undefined
          }
          folderId={selectedFolder !== "all" ? selectedFolder : undefined}
        />
      </div>

      {/* File Upload Dialog */}
      <FileUploader
        isOpen={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
      />

      {/* Import Dialog */}
      <ImportDialog
        isOpen={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
      />
    </div>
  );
}
