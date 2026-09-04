import TableRow from '@mui/material/TableRow';
import TableHead from '@mui/material/TableHead';
import TableCell from '@mui/material/TableCell';

// ----------------------------------------------------------------------

type ReportTableHeadProps = {
  headLabel: Record<string, any>[];
};

/**
 * No sort controls: ordering is decided server-side and is not a preference. Self-harm
 * reports come first because they are a welfare signal, then oldest-first so nothing
 * ages out of sight.
 */
export function ReportTableHead({ headLabel }: ReportTableHeadProps) {
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
