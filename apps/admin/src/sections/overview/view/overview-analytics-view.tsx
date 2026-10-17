import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Typography from '@mui/material/Typography';

import { DashboardContent } from 'src/layouts/dashboard';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------

/**
 * Placeholder until there are real numbers to show. The analytics widgets that used to
 * live here (AnalyticsWidgetSummary, AnalyticsWebsiteVisits, and the rest) are still in
 * src/sections/overview/ and ran entirely on mock data — they can be wired back up once
 * the reporting endpoints exist.
 */
export function OverviewAnalyticsView() {
  return (
    <DashboardContent>
      <Typography variant="h4" sx={{ mb: { xs: 3, md: 5 } }}>
        Dashboard
      </Typography>

      <Card
        sx={{
          py: 10,
          px: 3,
          gap: 2,
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          textAlign: 'center',
        }}
      >
        <Box
          sx={{
            width: 72,
            height: 72,
            display: 'flex',
            borderRadius: '50%',
            alignItems: 'center',
            color: 'primary.main',
            justifyContent: 'center',
            bgcolor: 'primary.lighter',
          }}
        >
          <Iconify width={36} icon="solar:clock-circle-outline" />
        </Box>

        <Typography variant="h4">Coming soon</Typography>

        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420 }}>
          Reporting for VivaMama is on its way. In the meantime, head to Consultations to
          confirm meeting times with patients.
        </Typography>
      </Card>
    </DashboardContent>
  );
}
