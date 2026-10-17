import { CONFIG } from 'src/config-global';

import { ModerationView } from 'src/sections/moderation/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Moderation - ${CONFIG.appName}`}</title>

      <ModerationView />
    </>
  );
}
