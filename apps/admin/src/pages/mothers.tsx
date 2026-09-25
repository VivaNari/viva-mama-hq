import { CONFIG } from 'src/config-global';

import { MothersView } from 'src/sections/mothers/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Mothers - ${CONFIG.appName}`}</title>

      <MothersView />
    </>
  );
}
