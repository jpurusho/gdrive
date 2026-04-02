import React from 'react';
import {
  Box,
  Typography,
  alpha,
  Card,
  CardActionArea,
  Chip,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useThemeContext } from '../theme/ThemeContext';
import type { ThemeDefinition } from '../theme/themes';

function ThemeCard({ def, selected, onSelect }: { def: ThemeDefinition; selected: boolean; onSelect: () => void }) {
  const { colors, mode } = def;

  return (
    <Card
      variant="outlined"
      sx={{
        width: 200,
        overflow: 'hidden',
        border: selected ? `2px solid ${colors.primary}` : undefined,
        boxShadow: selected ? `0 0 16px ${alpha(colors.primary, 0.3)}` : undefined,
        transition: 'all 0.2s ease',
      }}
    >
      <CardActionArea onClick={onSelect} sx={{ p: 0 }}>
        {/* Mini preview */}
        <Box sx={{ background: colors.background, p: 1.5, position: 'relative' }}>
          {selected && (
            <CheckCircleIcon
              sx={{ position: 'absolute', top: 6, right: 6, fontSize: 18, color: colors.primary }}
            />
          )}
          <Box display="flex" gap={0.75} mb={1}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff5f57' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#febc2e' }} />
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#28c840' }} />
          </Box>
          <Box display="flex" gap={1} height={50}>
            {/* Sidebar preview */}
            <Box sx={{ width: 40, bgcolor: colors.paper, borderRadius: 0.75, p: 0.5 }}>
              <Box sx={{ width: '100%', height: 4, bgcolor: colors.primary, borderRadius: 0.5, mb: 0.5 }} />
              <Box sx={{ width: '100%', height: 3, bgcolor: alpha(colors.textSecondary, 0.3), borderRadius: 0.5, mb: 0.5 }} />
              <Box sx={{ width: '100%', height: 3, bgcolor: alpha(colors.textSecondary, 0.3), borderRadius: 0.5 }} />
            </Box>
            {/* Content preview */}
            <Box sx={{ flex: 1, bgcolor: colors.paper, borderRadius: 0.75, p: 0.5 }}>
              <Box sx={{ width: '60%', height: 4, bgcolor: colors.text, borderRadius: 0.5, mb: 0.5, opacity: 0.7 }} />
              <Box sx={{ width: '80%', height: 3, bgcolor: alpha(colors.textSecondary, 0.4), borderRadius: 0.5, mb: 0.5 }} />
              <Box display="flex" gap={0.5} mt={0.75}>
                <Box sx={{ flex: 1, height: 14, bgcolor: colors.primary, borderRadius: 0.5, opacity: 0.8 }} />
                <Box sx={{ flex: 1, height: 14, bgcolor: colors.secondary, borderRadius: 0.5, opacity: 0.6 }} />
              </Box>
            </Box>
          </Box>
        </Box>
        {/* Label */}
        <Box
          sx={{ bgcolor: colors.paper, px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}
        >
          <Typography sx={{ fontSize: 13, fontWeight: 600, color: colors.text }}>
            {def.name}
          </Typography>
          <Chip
            label={mode}
            size="small"
            sx={{
              height: 18,
              fontSize: 10,
              ml: 'auto',
              bgcolor: mode === 'dark' ? alpha(colors.textSecondary, 0.15) : alpha(colors.primary, 0.1),
              color: mode === 'dark' ? colors.textSecondary : colors.primary,
            }}
          />
        </Box>
      </CardActionArea>
    </Card>
  );
}

export default function Settings() {
  const { themeId, setThemeId, availableThemes } = useThemeContext();

  return (
    <Box flex={1} overflow="auto" px={4} py={3}>
      <Typography variant="h5" mb={0.5}>Settings</Typography>
      <Typography variant="body2" color="text.secondary" mb={3}>
        Customize your GDrive Sync experience.
      </Typography>

      <Typography variant="subtitle1" mb={2}>Theme</Typography>
      <Box display="flex" flexWrap="wrap" gap={2}>
        {availableThemes.map((def) => (
          <ThemeCard
            key={def.id}
            def={def}
            selected={themeId === def.id}
            onSelect={() => setThemeId(def.id)}
          />
        ))}
      </Box>
    </Box>
  );
}
