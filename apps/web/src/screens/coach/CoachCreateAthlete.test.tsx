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
  await screen.findByRole('button', { name: 'ذخیره و ارسال دعوت' });
};

describe('C13 · Add athlete', () => {
  it('validates name and email before inviting', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره و ارسال دعوت' }));
    expect(screen.getByText('نام ورزشکار را وارد کنید.')).toBeTruthy();
    expect(screen.getByText('برای ارسال دعوت، یک ایمیل معتبر وارد کنید.')).toBeTruthy();
  });

  it('saves and invites the athlete, updating the preview as the coach types', async () => {
    await open();
    fireEvent.change(field('نام و نام خانوادگی'), { target: { value: 'ساناز احمدی' } });
    fireEvent.change(field('ایمیل'), { target: { value: 'sanaz@example.com' } });
    expect(screen.getByText(/با sanaz@example.com وارد شوید/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره و ارسال دعوت' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ path: '/athletes/', body: { name: 'ساناز احمدی', email: 'sanaz@example.com', invite: 'email' } });
  });

  it('copying the invite link saves the athlete as invited, once', async () => {
    await open();
    fireEvent.change(field('نام و نام خانوادگی'), { target: { value: 'کاوه' } });
    fireEvent.change(field('ایمیل'), { target: { value: 'kaveh@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'کپی لینک' }));
    await screen.findByRole('button', { name: 'کپی شد' });
    const posts = calls.filter((c) => c.method === 'POST' && c.path === '/athletes/');
    expect(posts).toHaveLength(1);
    expect(posts[0].body).toMatchObject({ name: 'کاوه', invite: 'link' });
  });
});
