import type { LabelColor } from 'src/components/label';
import type { Report, ReportReason, ReportStatus } from 'src/api/admin';

import { useState, useCallback } from 'react';

import Box from '@mui/material/Box';
import Popover from '@mui/material/Popover';
import TableRow from '@mui/material/TableRow';
import MenuList from '@mui/material/MenuList';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import MenuItem, { menuItemClasses } from '@mui/material/MenuItem';

import { fIstDateTime } from 'src/utils/ist';

import { Label } from 'src/components/label';
import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

const STATUS_COLOR: Record<ReportStatus, LabelColor> = {
  PENDING: 'warning',
  ACTIONED: 'success',
  DISMISSED: 'default',
};

/**
 * SELF_HARM is the only reason coloured as an error, and it is not about severity of
 * offence — it is a welfare signal in a postpartum mental-health community and needs to
 * be visually distinct from a content complaint.
 */
const REASON_COLOR: Record<ReportReason, LabelColor> = {
  SELF_HARM: 'error',
  HARASSMENT: 'warning',
  HATE: 'warning',
  SEXUAL: 'warning',
  MISINFORMATION: 'info',
  // Advice that could hurt someone if followed sits with SELF_HARM rather than with the
  // content complaints — on a maternal-health app it is the reason that can do damage.
  HARMFUL_ADVICE: 'error',
  SPAM: 'default',
  OTHER: 'default',
};

const REASON_LABEL: Record<ReportReason, string> = {
  SELF_HARM: 'Self-harm',
  HARASSMENT: 'Harassment',
  HATE: 'Hate speech',
  SEXUAL: 'Sexual content',
  MISINFORMATION: 'Health misinformation',
  HARMFUL_ADVICE: 'Harmful advice',
  SPAM: 'Spam',
  OTHER: 'Other',
};

const TYPE_LABEL: Record<string, string> = {
  VIVA_CLUB_POST: 'Post',
  VIVA_CLUB_COMMENT: 'Comment',
  AI_MESSAGE: 'AI message',
};

const personName = (user: Report['reporter']) =>
  user?.onboarding_data?.preferred_name || user?.mobile_number || user?.email || 'Unknown';

type ReportTableRowProps = {
  row: Report;
  onRemove: (row: Report) => void;
  onDismiss: (row: Report) => void;
  onBanAuthor: (row: Report) => void;
  onAcknowledge: (row: Report) => void;
};

export function ReportTableRow({
  row,
  onRemove,
  onDismiss,
  onBanAuthor,
  onAcknowledge,
}: ReportTableRowProps) {
  // Mirrors ACTIONABLE_CONTENT_TYPES on the server. Kept as a positive list rather than
  // `!== 'AI_MESSAGE'` so a new target type defaults to the safe, review-only menu.
  const actsOnContent =
    row.targetType === 'VIVA_CLUB_POST' || row.targetType === 'VIVA_CLUB_COMMENT';
  const [openPopover, setOpenPopover] = useState<HTMLButtonElement | null>(null);

  const handleOpenPopover = useCallback((event: React.MouseEvent<HTMLButtonElement>) => {
    setOpenPopover(event.currentTarget);
  }, []);

  const handleClosePopover = useCallback(() => setOpenPopover(null), []);

  const runAction = useCallback(
    (action: (row: Report) => void) => () => {
      handleClosePopover();
      action(row);
    },
    [handleClosePopover, row]
  );

  const resolved = row.status !== 'PENDING';

  return (
    <>
      <TableRow hover tabIndex={-1}>
        <TableCell>
          <Label color={REASON_COLOR[row.reason]}>{REASON_LABEL[row.reason]}</Label>
          {!!row.details && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}>
              {row.details}
            </Typography>
          )}
        </TableCell>

        <TableCell>
          <Typography variant="body2">{TYPE_LABEL[row.targetType] ?? row.targetType}</Typography>
        </TableCell>

        <TableCell sx={{ maxWidth: 360 }}>
          {/* The question that produced the reported answer, where there is one. An AI
              reply cannot be judged — or its prompt tuned — without it. */}
          {row.contextSnapshot && (
            <Typography
              variant="caption"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                color: 'text.secondary',
                whiteSpace: 'pre-wrap',
                fontStyle: 'italic',
                mb: 0.5,
              }}
            >
              She asked: {row.contextSnapshot}
            </Typography>
          )}

          {/* The snapshot, not a live lookup: the author may have deleted the content,
              and a reviewer cannot judge a report they cannot read. */}
          <Typography
            variant="body2"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              color: row.snapshot ? 'text.primary' : 'text.disabled',
              whiteSpace: 'pre-wrap',
            }}
          >
            {row.snapshot || '(no text captured)'}
          </Typography>
        </TableCell>

        <TableCell>
          {/* AI reports have no author, and `personName(null)` would render "Unknown" —
              which reads as a lookup that failed rather than a message nobody wrote. */}
          <Typography variant="body2" sx={{ color: actsOnContent ? undefined : 'text.secondary' }}>
            {actsOnContent ? personName(row.targetAuthor) : 'Viva AI'}
          </Typography>
          {row.targetAuthor?.communityBanned && (
            <Label color="error" sx={{ mt: 0.5 }}>
              Banned
            </Label>
          )}
        </TableCell>

        <TableCell>
          <Typography variant="body2">{personName(row.reporter)}</Typography>
        </TableCell>

        <TableCell>
          <Typography variant="body2">{fIstDateTime(row.createdAt)}</Typography>
        </TableCell>

        <TableCell>
          <Label color={STATUS_COLOR[row.status]}>{row.status}</Label>
        </TableCell>

        <TableCell align="right">
          <IconButton onClick={handleOpenPopover} disabled={resolved}>
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
            width: 200,
            display: 'flex',
            flexDirection: 'column',
            [`& .${menuItemClasses.root}`]: { px: 1, gap: 2, borderRadius: 0.75 },
          }}
        >
          {/* An AI reply is half of a private conversation: nothing to hide from anyone
              else, and no author to sanction. The server refuses both actions, so
              offering them would be a button that always fails — which is how a
              reviewer stops trusting the tool. */}
          {actsOnContent ? (
            <>
              <MenuItem onClick={runAction(onRemove)} sx={{ color: 'error.main' }}>
                <Iconify icon="solar:trash-bin-trash-bold" />
                Remove content
              </MenuItem>

              <MenuItem onClick={runAction(onDismiss)}>
                <Iconify icon="solar:check-circle-bold" />
                Dismiss report
              </MenuItem>

              <MenuItem onClick={runAction(onBanAuthor)} sx={{ color: 'error.main' }}>
                <Iconify icon="solar:shield-keyhole-bold-duotone" />
                Ban author
              </MenuItem>
            </>
          ) : (
            <>
              <MenuItem onClick={runAction(onAcknowledge)}>
                <Iconify icon="solar:check-circle-bold" />
                Acknowledge
              </MenuItem>

              <MenuItem onClick={runAction(onDismiss)}>
                <Iconify icon="mingcute:close-line" />
                Dismiss report
              </MenuItem>
            </>
          )}
        </MenuList>
      </Popover>
    </>
  );
}

// ----------------------------------------------------------------------

export function ReportTableNoData({ filtered }: { filtered: boolean }) {
  return (
    <TableRow>
      <TableCell align="center" colSpan={8}>
        <Box sx={{ py: 15, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {filtered ? 'Nothing matches those filters' : 'Nothing reported'}
          </Typography>
          <Typography variant="body2">
            {filtered
              ? 'Try clearing the status or type filter.'
              : 'Reports raised from the app will appear here.'}
          </Typography>
        </Box>
      </TableCell>
    </TableRow>
  );
}
