import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Info } from 'lucide-react';

interface AddServiceAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddServiceAccountDialog: React.FC<AddServiceAccountDialogProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [credentialsPath, setCredentialsPath] = useState('');
  const [storageLimit, setStorageLimit] = useState(15); // Default 15GB
  const [isActive, setIsActive] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Add service account mutation
  const addAccountMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/accounts', {
        name,
        email,
        credentialsPath,
        storageLimit: storageLimit * 1024 * 1024 * 1024, // Convert GB to bytes
        isActive
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/accounts/usage'] });
      toast({
        title: 'Service account added',
        description: 'The Google Drive service account has been added successfully.',
        variant: 'default'
      });
      resetForm();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to add service account',
        description: error.message || 'There was an error adding the service account.',
        variant: 'destructive'
      });
    }
  });

  const resetForm = () => {
    setName('');
    setEmail('');
    setCredentialsPath('');
    setStorageLimit(15);
    setIsActive(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    addAccountMutation.mutate();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Google Drive Service Account</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Account Name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Service Account"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Service Account Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="service-account@project.iam.gserviceaccount.com"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="credentialsPath">Credentials Path</Label>
            <Input
              id="credentialsPath"
              value={credentialsPath}
              onChange={(e) => setCredentialsPath(e.target.value)}
              placeholder="/credentials/service-account-credentials.json"
              required
            />
            <p className="text-xs text-muted-foreground">
              Path to the service account JSON key file that was downloaded from Google Cloud Console.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="storageLimit">Storage Limit (GB)</Label>
              <Input
                id="storageLimit"
                type="number"
                min="1"
                value={storageLimit}
                onChange={(e) => setStorageLimit(parseInt(e.target.value) || 15)}
                required
              />
            </div>
            <div className="space-y-2 pt-6">
              <div className="flex items-center space-x-2">
                <Switch checked={isActive} onCheckedChange={setIsActive} id="active" />
                <Label htmlFor="active">Account Active</Label>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-3 rounded-md text-sm flex items-start gap-2 text-blue-800">
            <Info className="h-5 w-5 flex-shrink-0 mt-0.5" />
            <div>
              <p>To create a Google Drive service account:</p>
              <ol className="list-decimal ml-5 mt-1 space-y-1">
                <li>Go to the Google Cloud Console</li>
                <li>Create a project if you don't have one</li>
                <li>Enable the Google Drive API</li>
                <li>Create a service account and download the JSON key file</li>
                <li>Share your Google Drive folders with the service account email</li>
              </ol>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={addAccountMutation.isPending}>
              {addAccountMutation.isPending ? 'Adding...' : 'Add Service Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};