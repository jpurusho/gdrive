import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import SyncIcon from '@mui/icons-material/Sync';
import React from 'react';

export const directionIcons: Record<string, React.ElementType> = {
  download: CloudDownloadIcon,
  upload: CloudUploadIcon,
  bidirectional: SyncIcon,
};

export const directionLabels: Record<string, string> = {
  download: 'Download',
  upload: 'Upload',
  bidirectional: 'Bidirectional',
};
