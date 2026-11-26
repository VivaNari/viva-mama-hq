import { CONFIG } from 'src/config-global';

import { ContentProfilesView } from 'src/sections/content/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Content summaries - ${CONFIG.appName}`}</title>

      <ContentProfilesView />
    </>
  );
}
