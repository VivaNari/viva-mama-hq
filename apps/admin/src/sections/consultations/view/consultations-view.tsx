import type { Consultation, ConsultationType, ConsultationStatus } from 'src/api/admin';

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
import { markCompleted, markUnhandled, getConsultations } from 'src/api/admin';

import { Scrollbar } from 'src/components/scrollbar';

import { TableNoData } from '../table-no-data';
import { ConfirmTimeDialog } from '../confirm-time-dialog';
import { ConfirmActionDialog } from '../confirm-action-dialog';
import { ConsultationTableRow } from '../consultation-table-row';
import { ConsultationTableHead } from '../consultation-table-head';
import { ConsultationTableToolbar } from '../consultation-table-toolbar';

// ----------------------------------------------------------------------

const HEAD_LABELS = [
  { id: 'user', label: 'Mother', minWidth: 180 },
  { id: 'type', label: 'Type' },
  { id: 'consultant', label: 'Consultant', minWidth: 140 },
  { id: 'preferred', label: 'Preferred', minWidth: 160 },
  { id: 'confirmed', label: 'Confirmed time', minWidth: 170 },
  { id: 'status', label: 'Status' },
  { id: '' },
];

type PendingAction = { type: 'completed' | 'unhandled'; row: Consultation } | null;

export function ConsultationsView() {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [filterName, setFilterName] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [status, setStatus] = useState<ConsultationStatus | ''>('');
  const [consultationType, setConsultationType] = useState<ConsultationType | ''>('');

  const [rows, setRows] = useState<Consultation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Bumped after every successful mutation to force a refetch.
  const [refreshKey, setRefreshKey] = useState(0);

  const [confirmTimeRow, setConfirmTimeRow] = useState<Consultation | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [actionError, setActionError] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);
  const [toast, setToast] = useState('');

  // Typing shouldn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filterName);
      setPage(0);
    }, 400);

    return () => clearTimeout(timer);
  }, [filterName]);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setLoadError('');

      try {
        const result = await getConsultations(
          {
            // The server is 1-indexed; TablePagination is 0-indexed.
            page: page + 1,
            limit: rowsPerPage,
            status,
            consultationType,
            search: debouncedSearch,
          },
          controller.signal
        );

        setRows(result.items);
        setTotal(result.total);
      } catch (err) {
        // A superseded request is not a failure — leave the UI to the newer one.
        if (!controller.signal.aborted) {
          setLoadError(extractError(err, 'Could not load consultations'));
          setRows([]);
          setTotal(0);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => controller.abort();
  }, [page, rowsPerPage, status, consultationType, debouncedSearch, refreshKey]);

  const refetch = useCallback(() => setRefreshKey((key) => key + 1), []);

  const handleChangePage = useCallback((_event: unknown, newPage: number) => {
    setPage(newPage);
  }, []);

  const handleChangeRowsPerPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleFilterStatus = useCallback((value: ConsultationStatus | '') => {
    setStatus(value);
    setPage(0);
  }, []);

  const handleFilterType = useCallback((value: ConsultationType | '') => {
    setConsultationType(value);
    setPage(0);
  }, []);

  const handleOpenAction = useCallback((type: 'completed' | 'unhandled', row: Consultation) => {
    setActionError('');
    setPendingAction({ type, row });
  }, []);

  const handleRunAction = useCallback(async () => {
    if (!pendingAction) {
      return;
    }

    setActionError('');
    setActionSubmitting(true);

    try {
      if (pendingAction.type === 'completed') {
        await markCompleted(pendingAction.row._id);
        setToast('Consultation marked completed.');
      } else {
        await markUnhandled(pendingAction.row._id);
        setToast('Consultation marked unhandled.');
      }

      setPendingAction(null);
      refetch();
    } catch (err) {
      setActionError(extractError(err, 'Could not update the consultation'));
    } finally {
      setActionSubmitting(false);
    }
  }, [pendingAction, refetch]);

  const notFound = !loading && !rows.length;

  return (
    <DashboardContent>
      <Box sx={{ mb: 5, display: 'flex', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Consultations
        </Typography>
      </Box>

      {!!loadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {loadError}
        </Alert>
      )}

      <Card>
        <ConsultationTableToolbar
          filterName={filterName}
          status={status}
          consultationType={consultationType}
          onFilterName={setFilterName}
          onFilterStatus={handleFilterStatus}
          onFilterType={handleFilterType}
        />

        {loading && <LinearProgress sx={{ height: 2 }} />}

        <Scrollbar>
          <TableContainer sx={{ overflow: 'unset' }}>
            <Table sx={{ minWidth: 960 }}>
              <ConsultationTableHead headLabel={HEAD_LABELS} />

              <TableBody>
                {rows.map((row) => (
                  <ConsultationTableRow
                    key={row._id}
                    row={row}
                    onConfirmTime={setConfirmTimeRow}
                    onMarkCompleted={(target) => handleOpenAction('completed', target)}
                    onMarkUnhandled={(target) => handleOpenAction('unhandled', target)}
                  />
                ))}

                {notFound && <TableNoData searchQuery={debouncedSearch} />}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>

        <TablePagination
          component="div"
          page={page}
          // The server's unfiltered-by-page total, not the length of this page.
          count={total}
          rowsPerPage={rowsPerPage}
          onPageChange={handleChangePage}
          rowsPerPageOptions={[5, 10, 25]}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Card>

      <ConfirmTimeDialog
        open={!!confirmTimeRow}
        consultation={confirmTimeRow}
        onClose={() => setConfirmTimeRow(null)}
        onSuccess={() => {
          setToast('Meeting time confirmed. The patient has been notified.');
          refetch();
        }}
      />

      <ConfirmActionDialog
        open={!!pendingAction}
        title={
          pendingAction?.type === 'completed' ? 'Mark as completed?' : 'Mark as unhandled?'
        }
        description={
          pendingAction?.type === 'completed'
            ? 'The patient will be notified that their consultation is complete and asked to leave a review.'
            : 'The booking will be marked unhandled. If it was paid for with a subscription credit, that credit is refunded to the patient.'
        }
        confirmLabel={pendingAction?.type === 'completed' ? 'Mark completed' : 'Mark unhandled'}
        confirmColor={pendingAction?.type === 'completed' ? 'primary' : 'error'}
        error={actionError}
        submitting={actionSubmitting}
        onClose={() => setPendingAction(null)}
        onConfirm={handleRunAction}
      />

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" variant="filled" onClose={() => setToast('')}>
          {toast}
        </Alert>
      </Snackbar>
    </DashboardContent>
  );
}
