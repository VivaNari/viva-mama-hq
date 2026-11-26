import type { ContentProfileState, ContentProfileListItem } from 'src/api/admin';

import { useMemo, useState, useEffect, useCallback } from 'react';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Table from '@mui/material/Table';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import MenuItem from '@mui/material/MenuItem';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import Typography from '@mui/material/Typography';
import LinearProgress from '@mui/material/LinearProgress';
import TableContainer from '@mui/material/TableContainer';

import { extractError } from 'src/utils/axios';

import { getContentProfiles } from 'src/api/admin';
import { DashboardContent } from 'src/layouts/dashboard';

import { Label } from 'src/components/label';
import { Scrollbar } from 'src/components/scrollbar';

import { STAGES, MEDIA_LABEL, STATE_LABEL } from '../constants';
import { ContentProfileDialog } from '../content-profile-dialog';

// ----------------------------------------------------------------------

export function ContentProfilesView() {
  const [rows, setRows] = useState<ContentProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [state, setState] = useState<ContentProfileState | ''>('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      setLoading(true);
      setLoadError('');
      try {
        setRows(await getContentProfiles(controller.signal));
      } catch (err) {
        if (!controller.signal.aborted) setLoadError(extractError(err, 'Could not load contents'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();

    return () => controller.abort();
  }, [refreshKey]);

  const refetch = useCallback(() => setRefreshKey((key) => key + 1), []);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter(
      (row) => (!state || row.state === state) && row.title.toLowerCase().includes(term)
    );
  }, [rows, state, search]);

  const approved = rows.filter((row) => row.state === 'APPROVED').length;

  return (
    <DashboardContent>
      <Box sx={{ mb: 5 }}>
        <Typography variant="h4">Content summaries</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          The chatbot can only suggest approved content. {approved} of {rows.length} approved.
        </Typography>
      </Box>

      {!!loadError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {loadError}
        </Alert>
      )}

      <Card>
        <Toolbar sx={{ gap: 2, py: 2, flexWrap: 'wrap' }}>
          <TextField
            label="Search title"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <TextField
            select
            label="Status"
            value={state}
            sx={{ minWidth: 180 }}
            onChange={(event) => setState(event.target.value as ContentProfileState | '')}
          >
            <MenuItem value="">All statuses</MenuItem>
            {Object.entries(STATE_LABEL).map(([value, label]) => (
              <MenuItem key={value} value={value}>
                {label.text}
              </MenuItem>
            ))}
          </TextField>
        </Toolbar>

        {loading && <LinearProgress sx={{ height: 2 }} />}

        <Scrollbar>
          <TableContainer sx={{ overflow: 'unset' }}>
            <Table sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Title</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Suitable for</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((row) => (
                  <TableRow key={row.contentId} hover>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{MEDIA_LABEL[row.mediaType]}</TableCell>
                    <TableCell>
                      {STAGES.filter((stage) => row.suitableFor.includes(stage.value))
                        .map((stage) => stage.label)
                        .join(', ') || '—'}
                    </TableCell>
                    <TableCell>
                      <Label color={STATE_LABEL[row.state].color}>
                        {STATE_LABEL[row.state].text}
                      </Label>
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => setOpenId(row.contentId)}>
                        Review
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && !visible.length && (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No contents found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Scrollbar>
      </Card>

      <ContentProfileDialog
        contentId={openId}
        onClose={() => setOpenId(null)}
        onChanged={refetch}
      />
    </DashboardContent>
  );
}
