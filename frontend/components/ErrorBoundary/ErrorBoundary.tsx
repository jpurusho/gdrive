import React from 'react';
import { Box, Typography, Button, alpha } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Props {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: string;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message || 'Something went wrong' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('UI Error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          display="flex"
          flexDirection="column"
          alignItems="center"
          justifyContent="center"
          p={4}
          gap={2}
          sx={{ minHeight: 200 }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 48, color: 'error.main', opacity: 0.6 }} />
          <Typography variant="subtitle1" fontWeight={600}>
            {this.props.fallbackTitle || 'Something went wrong'}
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center" maxWidth={400}>
            An unexpected error occurred. This has been logged. Try refreshing the view.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => this.setState({ hasError: false, error: '' })}
          >
            Try Again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
