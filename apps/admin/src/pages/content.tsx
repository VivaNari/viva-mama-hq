import { _posts } from 'src/_mock';
import { CONFIG } from 'src/config-global';

import { ContentView } from 'src/sections/content/view';

// ----------------------------------------------------------------------

export default function Page() {
  return (
    <>
      <title>{`Content library - ${CONFIG.appName}`}</title>

      <ContentView posts={_posts} />
    </>
  );
}
