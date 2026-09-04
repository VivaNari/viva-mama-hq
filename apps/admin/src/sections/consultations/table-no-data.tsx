import type { TableRowProps } from '@mui/material/TableRow';

import Box from '@mui/material/Box';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import Typography from '@mui/material/Typography';

// ----------------------------------------------------------------------

type TableNoDataProps = TableRowProps & {
  /** Empty when the list is genuinely empty rather than filtered to nothing. */
  searchQuery?: string;
};

export function TableNoData({ searchQuery, ...other }: TableNoDataProps) {
  return (
    <TableRow {...other}>
      <TableCell align="center" colSpan={7}>
        <Box sx={{ py: 15, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {searchQuery ? 'Not found' : 'No consultations yet'}
          </Typography>

          <Typography variant="body2">
            {searchQuery ? (
              <>
                No results found for &nbsp;<strong>&quot;{searchQuery}&quot;</strong>.
                <br /> Try checking for typos or using complete words.
              </>
            ) : (
              'Bookings made from the app will appear here.'
            )}
          </Typography>
        </Box>
      </TableCell>
    </TableRow>
  );
}
