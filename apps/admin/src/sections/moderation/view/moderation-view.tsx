import type { Report, ReportAction, ReportStatus, ReportTargetType } from 'src/api/admin';

import { useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import TableBody from '@mui/material/TableBody';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';
import TablePagination from '@mui/material/TablePagination';

import { extractError } from 'src/utils/axios';

import { DashboardContent } from 'src/layouts/dashboard';
import { getReports, actionReport } from 'src/api/admin';

import { Scrollbar } from 'src/components/scrollbar';

import { ReportTableHead } from '../report-table-head';
import { ReportTableToolbar } from '../report-table-toolbar';
import { ReportTableRow, ReportTableNoData } from '../report-table-row';
import { ConfirmActionDialog } from '../../consultations/confirm-action-dialog';

// ----------------------------------------------------------------------

const HEAD_LABELS = [
  { id: 'reason', label: 'Reason', minWidth: 160 },
  { id: 'type', label: 'Type' },
  { id: 'content', label: 'Reported content', minWidth: 280 },
  { id: 'author', label: 'Author', minWidth: 140 },
  { id: 'reporter', label: 'Reported by', minWidth: 140 },
  { id: 'when', label: 'Reported', minWidth: 150 },
  { id: 'status', label: 'Status' },
  { id: '' },
];

/**
 * Copy for each confirmation. Every one of these is hard to walk back, so every one
 * confirms — including ACKNOWLEDGE, which changes nothing a user sees but does close a
 * report that nobody will look at again.
 */
const ACTION_COPY: Record<ReportAction, { title: string; description: string; label: string }> = {
  REMOVE: {
    title: 'Remove this content?',
    description:
      'It stops being visible in the app immediately. The content is kept in the database, not deleted, so the decision can be explained or reversed later.',
    label: 'Remove',
  },
  DISMISS: {
    title: 'Dismiss this report?',
    description:
      'The content becomes visible again and its report count resets to zero, so a single new report will not re-hide it. Every report on this item is marked dismissed.',
    label: 'Dismiss',
  },
  BAN_AUTHOR: {
    title: 'Ban this author from the community?',
    description:
      'They can no longer post or comment, and the reported content is removed. Their account, check-ins and consultations are untouched — this is a community sanction, not a withdrawal of care.',
    label: 'Ban author',
  },
  ACKNOWLEDGE: {
    title: 'Acknowledge this report?',
    description:
      'Marks it reviewed and genuine, to be fed into prompt and filter tuning. Nothing is hidden from the user — an AI reply is half of a private conversation, so there is nothing to remove and nobody to ban.',
    label: 'Acknowledge',
  },
};

type PendingAction = { action: ReportAction; row: Report } | null;

/**
 * What actually happened, which is not the same sentence for every target.
 *
 * Dismissing a community report restores hidden content; dismissing an AI report
 * restores nothing, because nothing was ever hidden. Telling a reviewer content came
 * back when it never went away is how they lose their grip on what the queue does.
 */
function successMessage(pending: NonNullable<PendingAction>): string {
  const isCommunity = pending.row.targetType !== 'AI_MESSAGE';

  switch (pending.action) {
    case 'DISMISS':
      return isCommunity
        ? 'Report dismissed and the content restored.'
        : 'Report dismissed.';
    case 'BAN_AUTHOR':
      return 'Author banned from the community.';
    case 'ACKNOWLEDGE':
      return 'Report acknowledged for filter tuning.';
    default:
      return 'Content removed.';
  }
}

export function ModerationView() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Defaults to the only view that matters day to day: what still needs a decision.
  const [status, setStatus] = useState<ReportStatus | ''>('PENDING');
  const [targetType, setTargetType] = useState<ReportTargetType | ''>('');

  const [rows, setRows] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Bumped after every successful mutation to force a refetch.
  const [refreshKey, setRefreshKey] = useState(0);

  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setLoadError('');

      try {
        const result = await getReports(
          { page: page + 1, limit: rowsPerPage, status, targetType },
          controller.signal
        );
        setRows(result.reports);
        setTotal(result.pagination.total);
      } catch (err) {
        if (!controller.signal.aborted) {
          setLoadError(extractError(err, 'Could not load reports'));
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    })();

    return () => controller.abort();
  }, [page, rowsPerPage, status, targetType, refreshKey]);

  const refetch = useCallback(() => setRefreshKey((key) => key + 1), []);

  // Changing a filter has to reset to the first page, or the view lands on a page that
  // the narrowed result set no longer has.
  const handleFilterStatus = useCallback((value: ReportStatus | '') => {
    setStatus(value);
    setPage(0);
  }, []);

  const handleFilterType = useCallback((value: ReportTargetType | '') => {
    setTargetType(value);
    setPage(0);
  }, []);

  const handleOpenAction = useCallback((action: ReportAction, row: Report) => {
    setActionError('');
    setPendingAction({ action, row });
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!pendingAction) return;

    setActionError('');
    setActionSubmitting(true);

    try {
      await actionReport(pendingAction.row._id, pendingAction.action);
      setToast(successMessage(pendingAction));
      setPendingAction(null);
      refetch();
    } catch (err) {
      setActionError(extractError(err, 'Could not action the report'));
    } finally {
      setActionSubmitting(false);
    }
  }, [pendingAction, refetch]);

  const notFound = !loading && !rows.length;
  const copy = pendingAction ? ACTION_COPY[pendingAction.action] : null;

  return (
    <DashboardContent>
      <Box sx={{ mb: 5, display: 'flex', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Moderation
        </Typography>
      </Box>

      {!!loadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {loadError}
        </Alert>
      )}

      <Card>
        <ReportTableToolbar
          status={status}
          targetType={targetType}
          onFilterStatus={handleFilterStatus}
          onFilterType={handleFilterType}
        />

        {loading && <LinearProgress sx={{ height: 2 }} />}

        <Scrollbar>
          <TableContainer sx={{ overflow: 'unset' }}>
            <Table sx={{ minWidth: 1100 }}>
              <ReportTableHead headLabel={HEAD_LABELS} />

              <TableBody>
                {rows.map((row) => (
                  <ReportTableRow
                    key={row._id}
                    row={row}
                    onRemove={(target) => handleOpenAction('REMOVE', target)}
                    onDismiss={(target) => handleOpenAction('DISMISS', target)}
                    onBanAuthor={(target) => handleOpenAction('BAN_AUTHOR', target)}
                    onAcknowledge={(target) => handleOpenAction('ACKNOWLEDGE', target)}
                  />
                ))}

                {notFound && <ReportTableNoData filtered={!!status || !!targetType} />}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>

        <TablePagination
          component="div"
          page={page}
          // The server's total for the current filter, not the length of this page.
          count={total}
          rowsPerPage={rowsPerPage}
          onPageChange={(_, next) => setPage(next)}
          rowsPerPageOptions={[5, 10, 25]}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
        />
      </Card>

      <ConfirmActionDialog
        open={!!pendingAction}
        title={copy?.title ?? ''}
        description={copy?.description ?? ''}
        confirmLabel={copy?.label ?? ''}
        confirmColor={pendingAction?.action === 'DISMISS' ? 'primary' : 'error'}
        error={actionError}
        submitting={actionSubmitting}
        onClose={() => setPendingAction(null)}
        onConfirm={handleConfirmAction}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </DashboardContent>
  );
}
