import type { ModePreference } from '@baseline/tokens';
import { SegmentedControl, ThemeToggle } from '@/ds';
import { useThemeMode } from '@/lib/theme';
import { toast } from '@/lib/toast';

const OPTIONS = [
  { value: 'light', label: 'روشن', icon: 'sun' },
  { value: 'dark', label: 'تیره', icon: 'moon' },
  { value: 'system', label: 'خودکار', icon: 'circle-half' },
];

const LABEL: Record<ModePreference, string> = { light: 'حالت روشن', dark: 'حالت تیره', system: 'حالت خودکار (طبق سیستم)' };

/** Settings › Appearance: Light / Dark / System. Applied immediately and remembered on this device. */
export function AppearanceSettings() {
  const { preference, setPreference } = useThemeMode();
  return (
    <div style={{ maxWidth: 560, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 16, lineHeight: '24px', fontWeight: 600 }}>ظاهر</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: '20px', color: 'var(--text-muted)' }}>
            حالت نمایش پنل را انتخاب کنید. «خودکار» از تنظیم روشن یا تیره دستگاه پیروی می‌کند. رنگ برند در هر دو حالت ثابت است.
          </p>
        </div>
        <ThemeToggle />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 14, lineHeight: '20px', fontWeight: 500 }}>حالت نمایش</span>
        <SegmentedControl
          options={OPTIONS}
          value={preference}
          label="حالت نمایش"
          fullWidth
          onChange={(v) => {
            setPreference(v as ModePreference);
            toast(LABEL[v as ModePreference] + ' فعال شد', 'این انتخاب روی همین دستگاه ذخیره می‌شود.');
          }}
        />
      </div>
    </div>
  );
}
