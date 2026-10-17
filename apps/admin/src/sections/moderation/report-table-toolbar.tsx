import type { ReportStatus, ReportTargetType } from 'src/api/admin';

import Box from '@mui/material/Box';
import Select from '@mui/material/Select';
import Toolbar from '@mui/material/Toolbar';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';

// ----------------------------------------------------------------------

type ReportTableToolbarProps = {
  status: ReportStatus | '';
  targetType: ReportTargetType | '';
  onFilterStatus: (value: ReportStatus | '') => void;
  onFilterType: (value: ReportTargetType | '') => void;
};

/**
 * No free-text search, unlike the consultations toolbar. Searching a moderation queue
 * means searching reported content, and a box that surfaces abusive text on demand is
 * not something to build without a reason to.
 */
export function ReportTableToolbar({
  status,
  targetType,
  onFilterStatus,
  onFilterType,
}: ReportTableToolbarProps) {
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
      <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420 }}>
        Self-harm reports are listed first, then oldest first.
      </Typography>

      <Box sx={{ gap: 2, display: 'flex', flexWrap: 'wrap' }}>
        <FormControl sx={{ minWidth: 160 }}>
          <InputLabel id="report-status-label">Status</InputLabel>
          <Select
            labelId="report-status-label"
            value={status}
            label="Status"
            onChange={(event) => onFilterStatus(event.target.value as ReportStatus | '')}
          >
            <MenuItem value="">All statuses</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="ACTIONED">Actioned</MenuItem>
            <MenuItem value="DISMISSED">Dismissed</MenuItem>
          </Select>
        </FormControl>

        <FormControl sx={{ minWidth: 170 }}>
          <InputLabel id="report-type-label">Type</InputLabel>
          <Select
            labelId="report-type-label"
            value={targetType}
            label="Type"
            onChange={(event) => onFilterType(event.target.value as ReportTargetType | '')}
          >
            <MenuItem value="">All types</MenuItem>
            <MenuItem value="VIVA_CLUB_POST">Post</MenuItem>
            <MenuItem value="VIVA_CLUB_COMMENT">Comment</MenuItem>
          </Select>
        </FormControl>
      </Box>
    </Toolbar>
  );
}
