import React from 'react';
import { Box, List, ListItem, ListItemIcon, ListItemText, IconButton, Typography } from '@mui/material';
import {
  Folder as FolderIcon,
  InsertDriveFile as FileIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';

interface FileBrowserProps {
  type: 'local' | 'drive';
}

const FileBrowser: React.FC<FileBrowserProps> = ({ type }) => {
  // Placeholder data
  const files = [
    { name: 'Documents', type: 'folder', size: null },
    { name: 'Pictures', type: 'folder', size: null },
    { name: 'README.md', type: 'file', size: 2048 },
    { name: 'data.xlsx', type: 'file', size: 15360 },
  ];

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Path bar */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center' }}>
        <IconButton size="small">
          <BackIcon />
        </IconButton>
        <Typography variant="body2" sx={{ ml: 1 }}>
          {type === 'local' ? '/sync/local' : 'My Drive'}
        </Typography>
      </Box>

      {/* File list */}
      <List sx={{ flexGrow: 1, overflow: 'auto' }}>
        {files.map((file, index) => (
          <ListItem
            key={index}
            button
            sx={{
              '&:hover': {
                backgroundColor: 'action.hover',
              },
            }}
          >
            <ListItemIcon>
              {file.type === 'folder' ? <FolderIcon color="primary" /> : <FileIcon />}
            </ListItemIcon>
            <ListItemText
              primary={file.name}
              secondary={file.size ? `${(file.size / 1024).toFixed(2)} KB` : null}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default FileBrowser;