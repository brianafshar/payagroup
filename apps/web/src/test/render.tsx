import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { Toaster } from '@/app/Toaster';

/** Renders a screen the way the app does (router + toasts). */
export function renderScreen(ui: ReactElement, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      {ui}
      <Toaster />
    </MemoryRouter>,
  );
}
