import { CONFIG } from 'src/config-global';

import { ConsultationsView } from 'src/sections/consultations/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Consultations - ${CONFIG.appName}`}</title>

      <ConsultationsView />
    </>
  );
}
