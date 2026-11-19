import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, type Call } from '@/test/fakeApi';
import { renderScreen } from '@/test/render';
import AdminCoachesPage from './AdminCoaches';

let calls: Call[];
beforeEach(() => {
  calls = installFakeApi('admin');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const bodyRows = () => screen.getAllByRole('row').slice(1);

describe('A03 · Coaches', () => {
  it('lists the coaches from the API', async () => {
    renderScreen(<AdminCoachesPage />);
    await screen.findByText('آرش عبادی');
    expect(bodyRows()).toHaveLength(6);
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/coaches/?page_size=200' });
  });

  it('filters by status with live counts', async () => {
    renderScreen(<AdminCoachesPage />);
    await screen.findByText('آرش عبادی');
    fireEvent.click(screen.getByRole('button', { name: /دعوت‌شده/ }));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText('نسرین کمالی')).toBeTruthy();
  });

  it('extends a coach by 30 days through the API', async () => {
    renderScreen(<AdminCoachesPage />);
    await screen.findByText('آرش عبادی');
    const row = screen.getByText('آرش عبادی').closest('tr') as HTMLElement;
    fireEvent.click(within(row).getByRole('button', { name: 'اقدامات' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'تمدید ۳۰ روز' }));
    await screen.findByText('اعتبار تمدید شد');
    expect(calls.find((c) => c.method === 'POST')).toEqual({ method: 'POST', path: '/coaches/4/extend/', body: { days: 30 } });
    await waitFor(() => expect(calls.filter((c) => c.path === '/coaches/?page_size=200').length).toBe(2)); // list refetched
  });
});
