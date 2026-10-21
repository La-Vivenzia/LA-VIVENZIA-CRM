import { useEffect, useState } from 'react';

import { LV_MEDIA } from 'src/design/tokens';
import { tierFor, type LvTier } from 'src/design/responsive';

// Most responsive behaviour belongs in the stylesheet, where it costs nothing
// and cannot disagree with itself. This hook exists for the cases where the
// *component* genuinely differs rather than its box: a popover that has to be
// a bottom sheet, a table that has to render cards, a drag-and-drop zone that
// has to become a camera button. Rendering different markup is the point;
// hiding one copy with CSS would ship both to every screen reader.
//
// It reads matchMedia rather than a resize listener, so it fires once per
// crossing instead of once per pixel, and it degrades to 'desktop' when there
// is no matchMedia at all (a server render, or a test environment).

export const useLvTier = (): LvTier => {
  const [tier, setTier] = useState<LvTier>(() =>
    typeof window === 'undefined' || typeof window.matchMedia !== 'function' ? 'desktop' : tierFor(window.innerWidth),
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const tablet = window.matchMedia(LV_MEDIA.md);
    const desktop = window.matchMedia(LV_MEDIA.lg);
    const sync = () => setTier(desktop.matches ? 'desktop' : tablet.matches ? 'tablet' : 'mobile');

    sync();
    tablet.addEventListener('change', sync);
    desktop.addEventListener('change', sync);

    return () => {
      tablet.removeEventListener('change', sync);
      desktop.removeEventListener('change', sync);
    };
  }, []);

  return tier;
};

/** True on a phone, where an overlay docks to the bottom edge instead of floating. */
export const useIsPhone = (): boolean => useLvTier() === 'mobile';
