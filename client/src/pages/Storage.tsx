import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Plus, AlertTriangle } from 'lucide-react';

interface AccountData {
  id: number;
  name: string;
  email: string;
  storageLimit: number;
  storageUsed: number;
  isActive: boolean;
  createdAt: string;
}

export default function Storage() {
  // Fetch accounts
  const { data: accounts = [], isLoading, error } = useQuery<AccountData[]>({
    queryKey: ['/api/accounts/usage'],
  });

  // Calculate overall storage usage
  const totalStorageLimit = accounts.reduce((sum, account) => sum + account.storageLimit, 0);
  const totalStorageUsed = accounts.reduce((sum, account) => sum + account.storageUsed, 0);
  const overallUsagePercentage = totalStorageLimit > 0 
    ? Math.round((totalStorageUsed / totalStorageLimit) * 100) 
    : 0;
  
  // Check if any accounts are low on space
  const lowSpaceAccounts = accounts.filter(account => 
    (account.storageUsed / account.storageLimit) > 0.9
  );

  // Format bytes to human-readable format
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
  };

  if (isLoading) {
    return <div className="py-8 text-center">Loading storage information...</div>;
  }

  if (error) {
    return (
      <div className="py-8 text-center text-red-500">
        Error loading storage information: {(error as Error).message}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Storage Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-medium">Storage Management</h1>
        <Button className="mt-4 md:mt-0">
          <Plus className="mr-2 h-4 w-4" /> Add Service Account
        </Button>
      </div>

      {/* Overall Usage Card */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Storage Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Total Usage</span>
                <span>
                  {formatBytes(totalStorageUsed)} / {formatBytes(totalStorageLimit)} ({overallUsagePercentage}%)
                </span>
              </div>
              <Progress value={overallUsagePercentage} className="h-2" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-3">
                <div className="text-sm text-muted-foreground mb-1">Total Capacity</div>
                <div className="text-2xl font-semibold">{formatBytes(totalStorageLimit)}</div>
              </div>
              
              <div className="border rounded-lg p-3">
                <div className="text-sm text-muted-foreground mb-1">Used Space</div>
                <div className="text-2xl font-semibold">{formatBytes(totalStorageUsed)}</div>
              </div>
              
              <div className="border rounded-lg p-3">
                <div className="text-sm text-muted-foreground mb-1">Available Space</div>
                <div className="text-2xl font-semibold">{formatBytes(totalStorageLimit - totalStorageUsed)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Low Space Warning */}
      {lowSpaceAccounts.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Low Storage Space</AlertTitle>
          <AlertDescription>
            {lowSpaceAccounts.length === 1 
              ? `1 account is running low on storage space (${lowSpaceAccounts[0].name}).` 
              : `${lowSpaceAccounts.length} accounts are running low on storage space.`} 
            Consider adding a new service account soon.
          </AlertDescription>
        </Alert>
      )}

      {/* Service Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Service Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Storage</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => {
                const usagePercentage = Math.round((account.storageUsed / account.storageLimit) * 100);
                const isLowSpace = usagePercentage > 90;
                
                return (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">{account.name}</TableCell>
                    <TableCell>{account.email}</TableCell>
                    <TableCell>
                      {account.isActive ? (
                        isLowSpace ? (
                          <Badge className="bg-yellow-100 text-yellow-800">Low Space</Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-800">Healthy</Badge>
                        )
                      ) : (
                        <Badge variant="outline">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{formatBytes(account.storageUsed)} / {formatBytes(account.storageLimit)}</span>
                        <Progress 
                          value={usagePercentage} 
                          className={`h-1.5 mt-1 ${isLowSpace ? 'bg-yellow-200' : ''}`}
                          indicatorColor={isLowSpace ? 'bg-yellow-500' : undefined}
                        />
                      </div>
                    </TableCell>
                    <TableCell>{usagePercentage}%</TableCell>
                    <TableCell>{new Date(account.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
