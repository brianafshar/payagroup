import { useThemeMode } from '@/lib/theme';
import { Icon } from './Icon';
import { cx } from './utils';

/**
 * Animated light/dark switch: a 52×28 pill whose 22px knob slides (200ms, standard easing)
 * while its icon morphs sun ☀ → moon ☾. "System" is chosen in Settings › Appearance.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { mode, preference, setPreference } = useThemeMode();
  const dark = mode === 'dark';
  const label = dark ? 'حالت روشن' : 'حالت تیره';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={label}
      title={label + (preference === 'system' ? ' (اکنون: خودکار طبق سیستم)' : '')}
      className={cx('bl-mode-toggle', dark && 'is-dark', className)}
      onClick={() => setPreference(dark ? 'light' : 'dark')}
    >
      <span className="bl-mode-knob" aria-hidden="true">
        <span className="bl-mode-ic bl-mode-sun">
          <Icon name="sun" size={14} stroke={2} />
        </span>
        <span className="bl-mode-ic bl-mode-moon">
          <Icon name="moon" size={13} stroke={2} />
        </span>
      </span>
    </button>
  );
}
