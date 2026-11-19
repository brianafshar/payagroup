/** API error with the backend's stable `code` (see backend/README.md › Errors) and field messages. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status = 400,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }

  static fromResponse(status: number, data: unknown): ApiError {
    const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const fields: Record<string, string> = {};
    for (const [k, v] of Object.entries(body)) {
      if (k === 'code' || k === 'detail') continue;
      const first = Array.isArray(v) ? v[0] : v;
      if (typeof first === 'string') fields[k] = first;
    }
    const code = typeof body.code === 'string' ? body.code : status === 404 ? 'not_found' : status === 403 ? 'permission_denied' : 'invalid';
    const detail = typeof body.detail === 'string' ? body.detail : Object.values(fields)[0] || 'Request failed';
    return new ApiError(detail, code, status, fields);
  }
}

const FA: Record<string, string> = {
  network: 'اتصال به سرور برقرار نشد. اینترنت را بررسی کنید.',
  invalid_credentials: 'ایمیل یا رمز عبور درست نیست. دوباره تلاش کنید.',
  wrong_role: 'این حساب برای این پنل نیست.',
  coach_inactive: 'حساب مربی غیرفعال یا منقضی شده است. با پشتیبانی تماس بگیرید.',
  athlete_inactive: 'حساب شما فعال نیست. با مربی خود تماس بگیرید.',
  inactive: 'این حساب غیرفعال است.',
  session_ended: 'نشست شما پایان یافت. دوباره وارد شوید.',
  invalid_code: 'کد تأیید درست نیست.',
  mfa_token_expired: 'زمان وارد کردن کد تمام شد. دوباره وارد شوید.',
  mfa_setup_required: 'ابتدا ورود دومرحله‌ای را فعال کنید.',
  mfa_required_by_policy: 'ورود دومرحله‌ای برای مدیران الزامی است.',
  conflict: 'این ایمیل قبلاً ثبت شده است.',
  cap_reached: 'به سقف تعداد ورزشکاران رسیده‌اید.',
  invite_expired: 'این لینک منقضی شده یا قبلاً استفاده شده است.',
  reset_expired: 'این لینک منقضی شده یا قبلاً استفاده شده است.',
  in_use: 'این مورد در برنامه‌ها یا سوابق استفاده شده و حذف نمی‌شود.',
  permission_denied: 'اجازه این کار را ندارید.',
  not_found: 'پیدا نشد.',
  throttled: 'تعداد تلاش‌ها زیاد بود. کمی بعد دوباره امتحان کنید.',
  email_failed: 'ایمیل ارسال نشد. تنظیمات ایمیل (SMTP) سرور را بررسی کنید.',
};

/** A Persian message for toasts and inline errors. */
export function faError(e: unknown, fallback = 'مشکلی پیش آمد. دوباره تلاش کنید.'): string {
  return e instanceof ApiError ? (FA[e.code] ?? fallback) : fallback;
}
