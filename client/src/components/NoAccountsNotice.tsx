import React from 'react';
import { Card, CardContent, CardTitle, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon, ExternalLink } from 'lucide-react';

interface NoAccountsNoticeProps {
  onAddAccount: () => void;
}

export const NoAccountsNotice: React.FC<NoAccountsNoticeProps> = ({ onAddAccount }) => {
  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200 text-blue-800">
        <InfoIcon className="h-4 w-4" />
        <AlertTitle>Google Drive Service Accounts Required</AlertTitle>
        <AlertDescription>
          To enable file storage and streaming capabilities, you need to set up Google Drive service accounts.
          This allows the system to store and retrieve files securely.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>Set Up Google Drive Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-sm text-muted-foreground">
            <p className="mb-3">
              Google Drive integration allows the Content Delivery System to store and manage files 
              using Google Drive's infrastructure, which provides reliable storage and high-speed delivery.
            </p>
            <div className="mb-3">
              <h3 className="font-medium mb-2">Why you need service accounts:</h3>
              <ul className="list-disc pl-5 space-y-1">
                <li>Secure file storage without user authentication</li>
                <li>Automated file operations</li>
                <li>Scalable storage with Google's infrastructure</li>
                <li>Support for multiple accounts to increase storage capacity</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button onClick={onAddAccount} className="flex-1">
              Add Service Account
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => window.open('/credentials/README.md', '_blank')}>
              <ExternalLink className="mr-2 h-4 w-4" /> View Setup Instructions
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};