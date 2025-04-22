
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface MoveFileDialogProps {
  isOpen: boolean;
  onClose: () => void;
  file?: any;
}

export const MoveFileDialog: React.FC<MoveFileDialogProps> = ({
  isOpen,
  onClose,
  file
}) => {
  const [selectedFolder, setSelectedFolder] = React.useState<string>('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: folders = [] } = useQuery({
    queryKey: ['/api/folders'],
    enabled: isOpen
  });

  const moveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('PUT', `/api/files/${file?.id}/move`, {
        folderId: selectedFolder
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/uploads'] });
      toast({
        title: 'File moved successfully',
        variant: 'default'
      });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to move file',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move File</DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger>
              <SelectValue placeholder="Select destination folder" />
            </SelectTrigger>
            <SelectContent>
              {folders.map((folder: any) => (
                <SelectItem key={folder.id} value={folder.id.toString()}>
                  {folder.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={() => moveMutation.mutate()}
            disabled={!selectedFolder || moveMutation.isPending}
          >
            {moveMutation.isPending ? 'Moving...' : 'Move File'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
