import TableRow from '@mui/material/TableRow';
import TableHead from '@mui/material/TableHead';
import TableCell from '@mui/material/TableCell';

// ----------------------------------------------------------------------

type ConsultationTableHeadProps = {
  headLabel: Record<string, any>[];
};

/**
 * No sort controls and no select-all checkbox: ordering is decided server-side
 * (unconfirmed bookings first) and there are no bulk actions.
 */
export function ConsultationTableHead({ headLabel }: ConsultationTableHeadProps) {
  return (
    <TableHead>
      <TableRow>
        {headLabel.map((headCell) => (
          <TableCell
            key={headCell.id}
            align={headCell.align || 'left'}
            sx={{ width: headCell.width, minWidth: headCell.minWidth }}
          >
            {headCell.label}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
  );
}
