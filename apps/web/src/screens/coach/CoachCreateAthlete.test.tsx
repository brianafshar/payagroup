import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakeApi, type Call } from '@/test/fakeApi';
import { renderScreen } from '@/test/render';
import CoachCreateAthlete from './CoachCreateAthlete';

let calls: Call[];
beforeEach(() => {
  calls = installFakeApi('coach');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const field = (label: string) => screen.getByLabelText(label, { selector: 'input' });
const open = async () => {
  renderScreen(<CoachCreateAthlete />);
  await screen.findByRole('button', { name: 'ذخیره و ارسال پیامک' });
};

describe('C13 · Add athlete', () => {
  it('needs a name and a valid mobile number (no e-mail)', async () => {
    await open();
    expect(screen.queryByLabelText('ایمیل', { selector: 'input' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره و ارسال پیامک' }));
    expect(screen.getByText('نام ورزشکار را وارد کنید.')).toBeTruthy();
    expect(screen.getByText(/شماره موبایل را به‌صورت/)).toBeTruthy();
  });

  it('saves the athlete with name and phone only', async () => {
    await open();
    fireEvent.change(field('نام و نام خانوادگی'), { target: { value: 'ساناز احمدی' } });
    fireEvent.change(field('شماره موبایل'), { target: { value: '۰۹۱۲۱۲۳۴۵۶۷' } });
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره و ارسال پیامک' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST');
    expect(post).toMatchObject({ path: '/athletes/', body: { name: 'ساناز احمدی', phone: '09121234567' } });
    expect(post?.body).not.toHaveProperty('email');
  });
});
