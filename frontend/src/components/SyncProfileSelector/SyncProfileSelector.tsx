import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, Box } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../../store/store';
import { selectProfile } from '../../store/slices/profilesSlice';

const SyncProfileSelector: React.FC = () => {
  const dispatch = useDispatch();
  const { profiles, selectedProfile } = useSelector((state: RootState) => state.profiles);

  const handleChange = (event: any) => {
    const profile = profiles.find(p => p.id === event.target.value);
    dispatch(selectProfile(profile || null));
  };

  return (
    <Box sx={{ minWidth: 250 }}>
      <FormControl fullWidth size="small">
        <InputLabel id="profile-select-label">Sync Profile</InputLabel>
        <Select
          labelId="profile-select-label"
          id="profile-select"
          value={selectedProfile?.id || ''}
          label="Sync Profile"
          onChange={handleChange}
        >
          <MenuItem value="">
            <em>None</em>
          </MenuItem>
          {profiles.map((profile) => (
            <MenuItem key={profile.id} value={profile.id}>
              {profile.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default SyncProfileSelector;