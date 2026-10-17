import type { Dayjs } from 'dayjs';
import type { Consultation } from 'src/api/admin';

import dayjs from 'dayjs';
import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';

import { IST } from 'src/utils/ist';
import { extractError } from 'src/utils/axios';

import { confirmTime, outsideSlotConflict } from 'src/api/admin';

// ----------------------------------------------------------------------

/** IST hour each slot opens, used to seed the picker somewhere sensible. */
const SLOT_START_HOUR: Record<string, number> = {
  MORNING: 9,
  AFTERNOON: 12,
  EVENING: 15,
};

type ConfirmTimeDialogProps = {
  open: boolean;
  consultation: Consultation | null;
  onClose: () => void;
  onSuccess: () => void;
};

export function ConfirmTimeDialog({
  open,
  consultation,
  onClose,
  onSuccess,
}: ConfirmTimeDialogProps) {
  const [value, setValue] = useState<Dayjs | null>(null);
  const [error, setError] = useState('');
  /**
   * Set once the server has flagged the chosen time as outside the requested slot. Its
   * presence is what turns the primary button into "Confirm anyway" — the coordinator is
   * never blocked, only asked once.
   */
  const [outsideSlotWarning, setOutsideSlotWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !consultation) {
      return;
    }

    setError('');
    setOutsideSlotWarning('');
    // Seed with the booked day at the start of the slot the patient chose, so the
    // coordinator only has to nudge the time rather than navigate the calendar.
    const booked = dayjs(consultation.meeting_confirmed_at ?? consultation.preferred_consultation_date).tz(IST);

    setValue(
      consultation.meeting_confirmed_at
        ? booked
        : booked.hour(SLOT_START_HOUR[consultation.preferred_slot ?? 'MORNING'] ?? 9).minute(0).second(0).millisecond(0)
    );
  }, [open, consultation]);

  const handleSubmit = useCallback(async () => {
    if (!consultation || !value) {
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      // Full ISO with offset. The server reasons about the slot in IST and would read a
      // bare local string as UTC.
      //
      // The warning already on screen is the acknowledgement: a second press of the same
      // button is the coordinator saying the out-of-window time is deliberate.
      await confirmTime(consultation._id, value.toISOString(), !!outsideSlotWarning);
      onSuccess();
      onClose();
    } catch (err) {
      const conflict = outsideSlotConflict(err);

      if (conflict) {
        // Not a failure. The server held the write so this can be shown once; the next
        // press goes through.
        setOutsideSlotWarning(conflict.message);
      } else {
        // Shown verbatim — the server's message is more specific than anything restated
        // here.
        setError(extractError(err, 'Could not confirm the time'));
      }
    } finally {
      setSubmitting(false);
    }
  }, [consultation, value, outsideSlotWarning, onSuccess, onClose]);

  /**
   * A changed time is a different decision, so the acknowledgement does not carry over —
   * otherwise a coordinator who corrected a typo would skip the check on the new value.
   */
  const handleChange = useCallback((next: Dayjs | null) => {
    setValue(next);
    setOutsideSlotWarning('');
    setError('');
  }, []);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Confirm meeting time</DialogTitle>

      <DialogContent>
        <Box sx={{ pt: 1, gap: 2.5, display: 'flex', flexDirection: 'column' }}>
          {!!error && <Alert severity="error">{error}</Alert>}

          {!!outsideSlotWarning && <Alert severity="warning">{outsideSlotWarning}</Alert>}

          {!!consultation && (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              The patient requested the{' '}
              <Box component="span" sx={{ color: 'text.primary', fontWeight: 'fontWeightSemiBold' }}>
                {consultation.preferred_slot_label ?? consultation.preferred_slot ?? 'unspecified'}
              </Box>{' '}
              slot. Any time can be confirmed.
            </Typography>
          )}

          <DateTimePicker
            label="Confirmed time (IST)"
            value={value}
            timezone={IST}
            onChange={handleChange}
            // A desktop picker ships no action bar and closes only once the minutes are
            // picked. Its popup covers the dialog's own Cancel/Confirm row while it is
            // open, so a coordinator part-way through a selection had nothing left on
            // screen to press. OK closes it deliberately and hands the dialog back.
            closeOnSelect={false}
            slotProps={{
              textField: {
                fullWidth: true,
                helperText: 'Times are in India Standard Time.',
              },
              actionBar: { actions: ['cancel', 'accept'] },
              // On a short window the popup is taller than the gap below the field and
              // has no room to flip above it either, so its last calendar rows and the
              // OK button ended up under the bottom edge of the screen. Cap it to the
              // viewport and scroll what does not fit.
              desktopPaper: {
                sx: {
                  maxHeight: 'calc(100vh - 16px)',
                  overflowY: 'auto',
                },
              },
              popper: {
                // altAxis lets the popper slide up to stay on screen instead of only
                // flipping wholesale, so the capped paper is fully reachable.
                modifiers: [{ name: 'preventOverflow', options: { altAxis: true, padding: 8 } }],
              },
            }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={outsideSlotWarning ? 'warning' : 'primary'}
          onClick={handleSubmit}
          disabled={!value || submitting}
        >
          {(submitting && 'Confirming…') ||
            (outsideSlotWarning && 'Confirm anyway') ||
            'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
