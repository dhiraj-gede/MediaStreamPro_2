import { apiRequest } from './queryClient';

// File uploads
export const uploadFile = async (file: File, metadata: any) => {
  const formData = new FormData();
  formData.append('file', file);
  
  Object.entries(metadata).forEach(([key, value]) => {
    formData.append(key, String(value));
  });
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Upload failed: ${text || response.statusText}`);
  }
  
  return response.json();
};

// Google Drive import
export const importFromGoogleDrive = async (params: {
  fileId: string;
  uploadName: string;
  fileType: string;
  category: string;
  folderId?: string;
}) => {
  const queryParams = new URLSearchParams();
  queryParams.append('fileId', params.fileId);
  queryParams.append('uploadName', params.uploadName);
  queryParams.append('fileType', params.fileType);
  queryParams.append('category', params.category);
  
  if (params.folderId) {
    queryParams.append('folderId', params.folderId);
  }
  
  const response = await apiRequest(
    'GET',
    `/api/upload/googledrive?${queryParams.toString()}`,
  );
  
  return response.json();
};

// HLS conversion
export const createHlsConversionJob = async (params: {
  uploadId: number;
  resolutions: string[];
}) => {
  const response = await apiRequest(
    'POST',
    '/api/job/hls/create',
    params
  );
  
  return response.json();
};

export const getConversionJobs = async (uploadId: number) => {
  const response = await apiRequest(
    'GET',
    `/api/job/hls/getConversionJobs?uploadId=${uploadId}`,
  );
  
  return response.json();
};

export const getJobStatus = async (jobId: number) => {
  const response = await apiRequest(
    'GET',
    `/api/job/hls/get?jobId=${jobId}`,
  );
  
  return response.json();
};

// Folder management
export const getFolders = async () => {
  const response = await apiRequest('GET', '/api/folders');
  return response.json();
};

export const createFolder = async (name: string) => {
  const response = await apiRequest('POST', '/api/folders', { name });
  return response.json();
};

// Account management
export const getAccountsUsage = async () => {
  const response = await apiRequest('GET', '/api/accounts/usage');
  return response.json();
};
