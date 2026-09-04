import { CONFIG } from 'src/config-global';

import { OverviewAnalyticsView as DashboardView } from 'src/sections/overview/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Overview - ${CONFIG.appName}`}</title>
      <meta
        name="description"
        content="Operations console for the VivaMama postpartum care app — mothers, care programmes and content."
      />

      <DashboardView />
    </>
  );
}
