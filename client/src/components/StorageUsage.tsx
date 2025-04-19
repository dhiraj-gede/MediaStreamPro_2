import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';

interface StorageUsageProps {
  limit?: number;
}

interface AccountData {
  id: number;
  name: string;
  email: string;
  storageLimit: number;
  storageUsed: number;
  isActive: boolean;
}

export const StorageUsage: React.FC<StorageUsageProps> = ({ limit = 3 }) => {
  const { data: accounts = [], isLoading, error } = useQuery<AccountData[]>({
    queryKey: ['/api/accounts/usage'],
  });

  // Calculate remaining space across all accounts
  const totalStorageLimit = accounts.reduce((sum, account) => sum + account.storageLimit, 0);
  const totalStorageUsed = accounts.reduce((sum, account) => sum + account.storageUsed, 0);
  const overallUsagePercentage = totalStorageLimit > 0 
    ? Math.round((totalStorageUsed / totalStorageLimit) * 100) 
    : 0;

  // Format bytes to human-readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  };

  // Display accounts with responsive grid
  const displayedAccounts = limit ? accounts.slice(0, limit) : accounts;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-6">Loading storage information...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-500 text-center py-6">
            Error loading storage information: {(error as Error).message}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (accounts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center py-6">No Google Drive accounts configured.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-center justify-between pb-2">
        <CardTitle>Storage Usage</CardTitle>
        {limit && accounts.length > limit && (
          <Link href="/storage" className="text-primary hover:underline flex items-center">
            <span>View All</span>
            <span className="text-sm ml-1">chevron_right</span>
          </Link>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {displayedAccounts.map((account) => {
            const usagePercentage = Math.round((account.storageUsed / account.storageLimit) * 100);
            const isLowSpace = usagePercentage > 90;
            
            return (
              <div key={account.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-medium">{account.name}</h3>
                    <p className="text-muted-foreground text-sm">{account.email}</p>
                  </div>
                  {isLowSpace ? (
                    <Badge className="bg-yellow-100 text-yellow-800">Low Space</Badge>
                  ) : (
                    <Badge className="bg-green-100 text-green-800">Healthy</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Usage</span>
                      <span>
                        {formatBytes(account.storageUsed)} / {formatBytes(account.storageLimit)}
                      </span>
                    </div>
                    <Progress 
                      value={usagePercentage} 
                      className={`h-2 ${isLowSpace ? 'bg-yellow-200' : ''}`}
                      indicatorColor={isLowSpace ? 'bg-yellow-500' : undefined}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};
