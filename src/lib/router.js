/**
 * Lightweight History API router for real URLs and working browser Back/Forward buttons.
 * Routes:
 *   /            -> Pull Counter
 *   /import      -> Zero-Install Import
 *   /history     -> Pull History (supports ?pool=monopoly_limited|monopoly_standard|fork_lottery|mystery_box)
 *   /settings    -> Profiles & Sync
 */

import { useEffect, useState } from 'react';

const NAV_EVENT = 'hethereau:navigate';

export function getLocationSnapshot() {
  if (typeof window === 'undefined') {
    return { pathname: '/', search: '', poolParam: 'all' };
  }
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const search = window.location.search || '';
  const params = new URLSearchParams(search);
  const poolParam = params.get('pool') || 'all';
  return { pathname, search, poolParam };
}

export function navigate(to, { replace = false } = {}) {
  if (typeof window === 'undefined') return;
  const target = new URL(to, window.location.origin);
  const current = window.location.pathname + window.location.search;
  const next = target.pathname + target.search;
  if (current === next) return;

  if (replace) {
    window.history.replaceState({}, '', next);
  } else {
    window.history.pushState({}, '', next);
  }
  window.dispatchEvent(new Event(NAV_EVENT));
  window.scrollTo({ top: 0, behavior: 'auto' });
}

export function useLocation() {
  const [loc, setLoc] = useState(getLocationSnapshot);

  useEffect(() => {
    const sync = () => setLoc(getLocationSnapshot());
    window.addEventListener('popstate', sync);
    window.addEventListener(NAV_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(NAV_EVENT, sync);
    };
  }, []);

  return loc;
}
