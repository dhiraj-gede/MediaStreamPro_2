// API Base URL
export const API_BASE_URL = 'http://localhost:5000/api';

// File upload constants
export const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks
export const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB max file size

// Supported file types
export const SUPPORTED_FILE_TYPES = {
  video: ['video/mp4', 'video/x-matroska'],
  image: ['image/jpeg', 'image/png'],
  document: ['application/pdf'],
  code: ['application/zip']
};

// HLS conversion resolutions
export const HLS_RESOLUTIONS = ['1080p', '720p', '360p'];

// File status labels and colors
export const FILE_STATUS = {
  processing: {
    label: 'Processing',
    color: 'yellow'
  },
  ready: {
    label: 'Ready',
    color: 'green'
  },
  failed: {
    label: 'Failed',
    color: 'red'
  }
};

// Job status labels and colors
export const JOB_STATUS = {
  waiting: {
    label: 'Waiting',
    color: 'gray'
  },
  processing: {
    label: 'Processing',
    color: 'yellow'
  },
  ready: {
    label: 'Complete',
    color: 'green'
  },
  failed: {
    label: 'Failed',
    color: 'red'
  }
};
