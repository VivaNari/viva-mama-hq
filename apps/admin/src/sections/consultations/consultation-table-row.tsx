import type { LabelColor } from 'src/components/label';
import type { Consultation, ConsultationStatus } from 'src/api/admin';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import TableRow from '@mui/material/TableRow';
import MenuList from '@mui/material/MenuList';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import MenuItem, { menuItemClasses } from '@mui/material/MenuItem';

import { fIstDate, fIstDateTime } from 'src/utils/ist';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const STATUS_COLOR: Record<ConsultationStatus, LabelColor> = {
  PENDING: 'warning',
  COMPLETED: 'success',
  UNHANDLED: 'error',
};

// The CARE_MANAGER enum value is the stored one; "Postpartum counsellor" is what the
// role is called everywhere a human reads it, in the app and here.
const TYPE_LABEL: Record<string, string> = {
  EXPERT: 'Expert',
  CARE_MANAGER: 'Postpartum counsellor',
};

type ConsultationTableRowProps = {
  row: Consultation;
  onConfirmTime: (row: Consultation) => void;
  onMarkCompleted: (row: Consultation) => void;
  onMarkUnhandled: (row: Consultation) => void;
};

export function ConsultationTableRow({
  row,
  onConfirmTime,
  onMarkCompleted,
  onMarkUnhandled,
}: ConsultationTableRowProps) {
  const [openPopover, setOpenPopover] = useState<HTMLButtonElement | null>(null);

  const handleOpenPopover = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setOpenPopover(event.currentTarget);
  }, []);

  const handleClosePopover = useCallback(() => {
    setOpenPopover(null);
  }, []);

  const runAction = useCallback(
    (action: (row: Consultation) => void) => () => {
      handleClosePopover();
      action(row);
    },
    [handleClosePopover, row]
  );

  const patientName = row.userId?.onboarding_data?.preferred_name || 'Unnamed';
  const patientContact = row.userId?.mobile_number || row.userId?.email || '—';

  return (
    <>
      <TableRow hover tabIndex={-1}>
        <TableCell component="th" scope="row">
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="subtitle2" noWrap>
              {patientName}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
              {patientContact}
            </Typography>
          </Box>
        </TableCell>

        <TableCell>
          <Label variant="soft" color="default">
            {TYPE_LABEL[row.consultationType] ?? row.consultationType}
          </Label>
        </TableCell>

        <TableCell>{row.consultatorId?.name || '—'}</TableCell>

        <TableCell>
          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
            <Typography variant="body2" noWrap>
              {fIstDate(row.preferred_consultation_date)}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
              {row.preferred_slot_label ?? row.preferred_slot ?? '—'}
            </Typography>
          </Box>
        </TableCell>

        <TableCell>
          {row.meeting_confirmed_at ? (
            fIstDateTime(row.meeting_confirmed_at)
          ) : (
            <Label variant="soft" color="default">
              Not confirmed
            </Label>
          )}
        </TableCell>

        <TableCell>
          <Label color={row.requestStatus ? STATUS_COLOR[row.requestStatus] : 'default'}>
            {row.requestStatus ?? 'UNSET'}
          </Label>
        </TableCell>

        <TableCell align="right">
          <IconButton onClick={handleOpenPopover}>
            <Iconify icon="eva:more-vertical-fill" />
          </IconButton>
        </TableCell>
      </TableRow>

      <Popover
        open={!!openPopover}
        anchorEl={openPopover}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuList
          disablePadding
          sx={{
            p: 0.5,
            gap: 0.5,
            width: 190,
            display: 'flex',
            flexDirection: 'column',
            [`& .${menuItemClasses.root}`]: {
              px: 1,
              gap: 2,
              borderRadius: 0.75,
              [`&.${menuItemClasses.selected}`]: { bgcolor: 'action.selected' },
            },
          }}
        >
          <MenuItem onClick={runAction(onConfirmTime)}>
            <Iconify icon="solar:clock-circle-outline" />
            Confirm time
          </MenuItem>

          <MenuItem onClick={runAction(onMarkCompleted)}>
            <Iconify icon="solar:check-circle-bold" />
            Mark completed
          </MenuItem>

          <MenuItem onClick={runAction(onMarkUnhandled)} sx={{ color: 'error.main' }}>
            <Iconify icon="mingcute:close-line" />
            Mark unhandled
          </MenuItem>
        </MenuList>
      </Popover>
    </>
  );
}
