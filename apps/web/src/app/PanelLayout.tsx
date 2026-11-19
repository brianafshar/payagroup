import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { setNavOpen, useNavOpen } from '@/lib/navDrawer';
import { CoachGuide } from './CoachGuide';

export interface PanelLayoutProps {
  /** White-label theme (`data-theme`), e.g. `brand` or a coach theme. */
  theme?: string;
  sidebar: ReactNode;
  topBar: ReactNode;
  /** Modals/drawers rendered above the page. */
  overlays?: ReactNode;
  /** Viewport-height page without document scroll (e.g. chat); content scrolls internally. */
  fullHeight?: boolean;
  /** The screen still shows the design's sample data (not yet backed by the API): say so in live mode. */
  children?: ReactNode;
}

const rootStyle: CSSProperties = {
  width: '100%',
  position: 'relative',
  background: 'var(--background)',
  color: 'var(--text-primary)',
  fontFamily: "'Vazirmatn',var(--font-sans)",
  boxSizing: 'border-box',
  display: 'flex',
};

/**
 * Admin/Coach desktop frame: collapsible sidebar (sticky, full viewport height) + main column
 * with the top bar and page content. Matches the frame shared by every A02–A08 / C10–C33 design.
 * On a phone (app/responsive.css) the sidebar becomes a drawer opened from the top bar's menu button.
 */
export function PanelLayout({ theme = 'brand', sidebar, topBar, overlays, fullHeight, children }: PanelLayoutProps) {
  // PAYA Group has a single fixed brand (no per-coach white-label themes).
  theme = 'brand';
  const navOpen = useNavOpen();
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [navOpen]);
  // A new page (this layout mounts again) starts with the drawer closed.
  useEffect(() => () => setNavOpen(false), []);
  return (
    <div
      data-theme={theme}
      dir="rtl"
      className={'bl-panel' + (navOpen ? ' is-nav-open' : '')}
      style={{ ...rootStyle, ...(fullHeight ? { height: '100vh', overflow: 'hidden' } : { minHeight: '100vh' }) }}
    >
      <div className="bl-panel-side">{sidebar}</div>
      <div className="bl-panel-scrim" aria-hidden="true" onClick={() => setNavOpen(false)} />
      <div className="bl-panel-main" style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', ...(fullHeight ? { minHeight: 0 } : null) }}>
        {topBar}
        {children}
      </div>
      {overlays}
      <CoachGuide />
    </div>
  );
}
