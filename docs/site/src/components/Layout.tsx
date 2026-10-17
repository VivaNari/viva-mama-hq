import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false);
  const { pathname } = useLocation();

  // Close the mobile drawer on navigation, otherwise tapping a link leaves the
  // overlay covering the page the reader just asked for.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Jump to the top on route change. Without this the browser preserves scroll
  // position and a new page opens halfway down.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // Escape closes the drawer — expected of anything modal.
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen]);

  return (
    <div className="app">
      {/* Decorative ambient glow. aria-hidden and pointer-events:none, so it is
          invisible to assistive tech and never intercepts a click. */}
      <div className="aura" aria-hidden="true">
        <span className="aura-1" />
        <span className="aura-3" />
      </div>

      <TopBar navOpen={navOpen} onToggleNav={() => setNavOpen((v) => !v)} />
      <div className="shell">
        <Sidebar open={navOpen} />
        {navOpen && (
          <button
            type="button"
            className="scrim"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          />
        )}
        <main className="content" id="main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
