import { act, fireEvent, screen } from '@testing-library/react-native';
import { nutrition, session } from '../data/athlete';
import { SEED, workout } from '../data/workout';
import { LoginScreen } from '../screens/LoginScreen';
import { LogScreen } from '../screens/LogScreen';
import { NutritionScreen } from '../screens/NutritionScreen';
import { PasswordScreen } from '../screens/PasswordScreen';
import { renderScreen } from '../test-utils';

beforeEach(() => {
  jest.useFakeTimers();
  workout.set(SEED);
  session.set({ signedIn: false });
});
afterEach(() => jest.useRealTimers());

test('M34 login validates, then signs in', async () => {
  await renderScreen(LoginScreen);
  await fireEvent.press(screen.getByText('ورود'));
  expect(screen.getByText('یک ایمیل معتبر وارد کنید.')).toBeTruthy();
  expect(screen.getByText('رمز عبور را وارد کنید.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('ایمیل'), 'ali@example.com');
  await fireEvent.changeText(screen.getByLabelText('رمز عبور'), 'secret-123');
  await fireEvent.press(screen.getByText('ورود'));
  await act(() => jest.advanceTimersByTime(800));
  expect(session.get().signedIn).toBe(true);
});

test('M34 forgot password asks for the email', async () => {
  await renderScreen(LoginScreen);
  await fireEvent.press(screen.getByText('رمز عبور را فراموش کرده‌اید؟'));
  await fireEvent.press(screen.getByText('ارسال رمز جدید'));
  expect(screen.getByText('ایمیل را وارد کن.')).toBeTruthy();
});

test('password screen: forced after a temporary password, validates before saving', async () => {
  session.set({ signedIn: true, mustChangePassword: true });
  await renderScreen(PasswordScreen);
  expect(screen.getByText('رمز موقت')).toBeTruthy();
  expect(screen.getByText('خروج از حساب')).toBeTruthy();
  await fireEvent.press(screen.getByText('ذخیره رمز جدید'));
  expect(screen.getByText('رمز فعلی را وارد کن.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('رمز موقت (از ایمیل)'), 'Hq7mR2xkTa');
  await fireEvent.changeText(screen.getByLabelText('رمز جدید'), 'short');
  await fireEvent.changeText(screen.getByLabelText('تکرار رمز جدید'), 'other');
  await fireEvent.press(screen.getByText('ذخیره رمز جدید'));
  expect(screen.getByText('رمز باید حداقل ۸ کاراکتر و یک عدد داشته باشد.')).toBeTruthy();
  expect(screen.getByText('تکرار رمز یکسان نیست.')).toBeTruthy();
});

test('M38 ticking the active set logs the prefilled target and starts the rest timer', async () => {
  await renderScreen(LogScreen, { e: 3 });
  expect(screen.getAllByText('پشت بازو سیم‌کش')).toHaveLength(2); // tab chip + heading
  await fireEvent.press(screen.getByText('ثبت ست ۲'));
  expect(workout.get().logs[3]).toEqual([
    [25, 12],
    [25, 12],
  ]);
  expect(screen.getByText('استراحت')).toBeTruthy();
  expect(screen.getByText('۱:۰۰')).toBeTruthy();
  await act(() => jest.advanceTimersByTime(1000));
  expect(screen.getByText('۰:۵۹')).toBeTruthy();
});

test('M38 edited weight/reps are logged instead of the target', async () => {
  await renderScreen(LogScreen, { e: 3 });
  await fireEvent.changeText(screen.getByLabelText('وزنه ست ۲'), '۲۷٫۵');
  await fireEvent.changeText(screen.getByLabelText('تکرار ست ۲'), '۱۰');
  await fireEvent.press(screen.getByLabelText('ثبت ست ۲'));
  expect(workout.get().logs[3][1]).toEqual([27.5, 10]);
});

test('M40 logging a meal updates the count and totals', async () => {
  nutrition.set({ st: ['followed', 'partial', 'unlogged', 'unlogged'], water: 1.5 });
  await renderScreen(NutritionScreen);
  expect(screen.getByText('۲ از ۴ وعده ثبت شده')).toBeTruthy();
  await fireEvent.press(screen.getAllByText('رعایت شد')[2]);
  expect(screen.getByText('۳ از ۴ وعده ثبت شده')).toBeTruthy();
  expect(nutrition.get().st[2]).toBe('followed');
});
