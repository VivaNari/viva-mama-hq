import type { ConsultationType, ConsultationStatus } from 'src/api/admin';

import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import Toolbar from '@mui/material/Toolbar';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputAdornment from '@mui/material/InputAdornment';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

type ConsultationTableToolbarProps = {
  filterName: string;
  status: ConsultationStatus | '';
  consultationType: ConsultationType | '';
  onFilterName: (value: string) => void;
  onFilterStatus: (value: ConsultationStatus | '') => void;
  onFilterType: (value: ConsultationType | '') => void;
};

export function ConsultationTableToolbar({
  filterName,
  status,
  consultationType,
  onFilterName,
  onFilterStatus,
  onFilterType,
}: ConsultationTableToolbarProps) {
  return (
    <Toolbar
      sx={{
        height: 96,
        display: 'flex',
        justifyContent: 'space-between',
        p: (theme) => theme.spacing(0, 1, 0, 3),
        gap: 2,
        flexWrap: 'wrap',
      }}
    >
      <OutlinedInput
        fullWidth
        value={filterName}
        onChange={(event) => onFilterName(event.target.value)}
        placeholder="Search by name, mobile or email…"
        startAdornment={
          <InputAdornment position="start">
            <Iconify width={20} icon="eva:search-fill" sx={{ color: 'text.disabled' }} />
          </InputAdornment>
        }
        sx={{ maxWidth: 320 }}
      />

      <Box sx={{ gap: 2, display: 'flex', flexWrap: 'wrap' }}>
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel id="consultation-status-label">Status</InputLabel>
          <Select
            labelId="consultation-status-label"
            value={status}
            label="Status"
            onChange={(event) => onFilterStatus(event.target.value as ConsultationStatus | '')}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="COMPLETED">Completed</MenuItem>
            <MenuItem value="UNHANDLED">Unhandled</MenuItem>
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 170 }}>
          <InputLabel id="consultation-type-label">Type</InputLabel>
          <Select
            labelId="consultation-type-label"
            value={consultationType}
            label="Type"
            onChange={(event) => onFilterType(event.target.value as ConsultationType | '')}
          >
            <MenuItem value="">All types</MenuItem>
            <MenuItem value="EXPERT">Expert</MenuItem>
            <MenuItem value="CARE_MANAGER">Postpartum counsellor</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </Toolbar>
  );
}
