import { useState, type CSSProperties, type ReactNode } from 'react';
import { Button, IconButton } from './actions';
import { Calendar } from './data';
import { ProgressBar } from './metrics';
import { BrandMark } from './identity';
import { Icon, type IconName } from './Icon';
import { cx, fmt, num, useSynced, useUid, type Numeric } from './utils';

type IconRef = IconName | (string & {});

export interface Option<V extends string = string> {
  value: V;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  icon?: IconRef;
}
type OptionInput = Option | string;

function normOptions(options?: readonly OptionInput[]): Option[] {
  return (options || []).map((o) => (typeof o === 'string' ? { value: o, label: o } : o));
}

interface FieldBase {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  style?: CSSProperties;
}

function Field(p: FieldBase, control: ReactNode, id: string) {
  return (
    <div className={cx('bl-field', p.className)} style={p.style}>
      {p.label ? (
        <label className="bl-label" htmlFor={id}>
          {p.label}
          {p.required ? (
            <span className="bl-req" aria-hidden="true">
              {' '}
              *
            </span>
          ) : null}
          {p.optional ? <span className="bl-opt">اختیاری</span> : null}
        </label>
      ) : null}
      {control}
      {p.error ? (
        <div className="bl-field-msg bl-field-error" id={id + '-msg'}>
          <Icon name="alert-circle" size={14} stroke={2} />
          {p.error}
        </div>
      ) : p.hint ? (
        <div className="bl-field-msg" id={id + '-msg'}>
          {p.hint}
        </div>
      ) : null}
    </div>
  );
}

export interface TextFieldProps extends FieldBase {
  value?: string | number;
  placeholder?: string;
  type?: string;
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search' | 'none';
  dir?: 'ltr' | 'rtl' | 'auto';
  multiline?: boolean;
  rows?: Numeric;
  /** `sm` renders as `md` (as in the prototype); `lg` is the tall variant. */
  size?: 'sm' | 'md' | 'lg';
  icon?: IconRef;
  prefix?: ReactNode;
  suffix?: ReactNode;
  disabled?: boolean;
  readOnly?: boolean;
  demoState?: string;
  onChange?: (v: string) => void;
}

/** Text input. Uncontrolled (`value` is the initial value), like the design prototypes. */
export function TextField(p: TextFieldProps) {
  const id = useUid('tf');
  const err = !!p.error;
  const [shown, setShown] = useState(false);
  const isPw = p.type === 'password' && !p.multiline;
  const common = {
    id,
    dir: p.dir,
    style: p.dir === 'ltr' ? ({ textAlign: 'right' } as CSSProperties) : undefined,
    className: 'bl-input-el',
    placeholder: p.placeholder,
    defaultValue: p.value,
    onChange: p.onChange ? (e: { target: { value: string } }) => p.onChange?.(e.target.value) : undefined,
    disabled: p.disabled || undefined,
    readOnly: p.readOnly || undefined,
    'aria-invalid': err || undefined,
    'aria-required': p.required || undefined,
    'aria-describedby': p.error || p.hint ? id + '-msg' : undefined,
  };
  const el = p.multiline ? (
    <textarea rows={num(p.rows, 3)} {...common} />
  ) : (
    <input type={isPw ? (shown ? 'text' : 'password') : p.type || 'text'} inputMode={p.inputMode} {...common} />
  );
  const box = (
    <div
      className={cx(
        'bl-input',
        p.multiline && 'bl-input-ml',
        p.size === 'lg' && 'bl-input-lg',
        err && 'is-error',
        p.disabled && 'is-disabled',
        p.readOnly && 'is-readonly',
        p.demoState && 'is-' + p.demoState,
      )}
    >
      {p.icon ? <Icon name={p.icon} size={18} className="bl-input-icon" /> : null}
      {p.prefix ? <span className="bl-affix">{p.prefix}</span> : null}
      {el}
      {p.suffix ? <span className="bl-affix">{p.suffix}</span> : null}
      {p.readOnly ? <Icon name="lock" size={14} className="bl-input-icon" label="فقط خواندنی" /> : null}
      {isPw ? (
        <button
          type="button"
          className="bl-pw-toggle"
          aria-label={shown ? 'پنهان کردن رمز' : 'نمایش رمز'}
          title={shown ? 'پنهان کردن رمز' : 'نمایش رمز'}
          aria-pressed={shown}
          disabled={p.disabled || undefined}
          onClick={() => setShown(!shown)}
        >
          <Icon name={shown ? 'eye-off' : 'eye'} size={18} />
        </button>
      ) : null}
    </div>
  );
  return Field(p, box, id);
}

export interface SelectProps extends FieldBase {
  options?: readonly OptionInput[];
  value?: string | null;
  placeholder?: string;
  size?: 'sm' | 'md' | 'lg';
  icon?: IconRef;
  disabled?: boolean;
  open?: boolean;
  demoState?: string;
  onChange?: (v: string) => void;
}

export function Select(p: SelectProps) {
  const id = useUid('sel');
  const opts = normOptions(p.options);
  const [val, setVal] = useSynced(p.value);
  const [open, setOpen] = useState(!!p.open);
  const cur = opts.find((o) => o.value === val);
  const err = !!p.error;
  const box = (
    <div className="bl-select-wrap">
      <button
        id={id}
        type="button"
        className={cx(
          'bl-input',
          'bl-select',
          p.size === 'lg' && 'bl-input-lg',
          err && 'is-error',
          p.disabled && 'is-disabled',
          (open || p.demoState === 'focus') && 'is-focus',
          p.demoState === 'hover' && 'is-hover',
        )}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={p.disabled || undefined}
        aria-invalid={err || undefined}
        onClick={() => setOpen(!open)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
      >
        {p.icon ? <Icon name={p.icon} size={18} className="bl-input-icon" /> : null}
        <span className={cx('bl-select-val', !cur && 'is-placeholder')}>{cur ? cur.label : p.placeholder || 'انتخاب…'}</span>
        <Icon name="chevron-down" size={18} className="bl-input-icon" />
      </button>
      {open ? (
        <div className="bl-menu bl-select-menu" role="listbox">
          {opts.map((o) => {
            const on = !!cur && o.value === cur.value;
            return (
              <div
                key={o.value}
                role="option"
                aria-selected={on}
                aria-disabled={o.disabled || undefined}
                className={cx('bl-menu-item', on && 'is-active', o.disabled && 'is-disabled')}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (o.disabled) return;
                  setVal(o.value);
                  setOpen(false);
                  p.onChange?.(o.value);
                }}
              >
                <span className="bl-menu-check">{on ? <Icon name="check" size={16} /> : null}</span>
                <span className="bl-menu-label">
                  {o.label}
                  {o.description ? <span className="bl-menu-desc">{o.description}</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
  return Field(p, box, id);
}

export interface SearchFieldProps {
  value?: string;
  placeholder?: string;
  label?: string;
  size?: 'sm' | 'md';
  shortcut?: string;
  demoState?: string;
  onChange?: (v: string) => void;
}

export function SearchField(p: SearchFieldProps) {
  return (
    <div className={cx('bl-input', 'bl-search', p.size === 'sm' && 'bl-input-sm', p.demoState && 'is-' + p.demoState)} role="search">
      <Icon name="search" size={18} className="bl-input-icon" />
      <input
        type="search"
        className="bl-input-el"
        placeholder={p.placeholder || 'جستجو'}
        defaultValue={p.value}
        onChange={p.onChange ? (e) => p.onChange?.(e.target.value) : undefined}
        aria-label={p.label || p.placeholder || 'جستجو'}
      />
      {p.value ? (
        <button type="button" className="bl-search-clear" aria-label="پاک کردن جستجو">
          <Icon name="x" size={14} />
        </button>
      ) : p.shortcut ? (
        <kbd className="bl-kbd">{p.shortcut}</kbd>
      ) : null}
    </div>
  );
}

export interface CheckboxProps {
  label?: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  indeterminate?: boolean;
  disabled?: boolean;
  error?: ReactNode;
  ariaLabel?: string;
  demoState?: string;
  onChange?: (checked: boolean) => void;
}

export function Checkbox(p: CheckboxProps) {
  const [on, setOn] = useSynced(!!p.checked);
  const ind = !!p.indeterminate;
  return (
    <label className={cx('bl-check', p.disabled && 'is-disabled', p.demoState && 'is-' + p.demoState, !!p.error && 'is-error')}>
      <input
        type="checkbox"
        className="bl-sr"
        checked={on}
        disabled={p.disabled || undefined}
        aria-label={p.label ? undefined : p.ariaLabel}
        aria-checked={ind ? 'mixed' : undefined}
        onChange={() => {
          setOn(!on);
          p.onChange?.(!on);
        }}
      />
      <span className={cx('bl-check-box', (on || ind) && 'is-on')} aria-hidden="true">
        {ind ? <Icon name="minus" size={14} stroke={2.5} /> : on ? <Icon name="check" size={14} stroke={2.5} /> : null}
      </span>
      {p.label || p.description ? (
        <span className="bl-check-text">
          <span className="bl-check-label">{p.label}</span>
          {p.description ? <span className="bl-check-desc">{p.description}</span> : null}
        </span>
      ) : null}
    </label>
  );
}

export interface RadioProps {
  name?: string;
  value: string;
  label?: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  disabled?: boolean;
  demoState?: string;
  onChange?: (v: string) => void;
}

export function Radio(p: RadioProps) {
  return (
    <label className={cx('bl-check', 'bl-radio', p.disabled && 'is-disabled', p.demoState && 'is-' + p.demoState)}>
      <input type="radio" className="bl-sr" name={p.name} checked={!!p.checked} onChange={() => p.onChange?.(p.value)} disabled={p.disabled || undefined} value={p.value} />
      <span className={cx('bl-radio-dot', p.checked && 'is-on')} aria-hidden="true" />
      <span className="bl-check-text">
        <span className="bl-check-label">{p.label}</span>
        {p.description ? <span className="bl-check-desc">{p.description}</span> : null}
      </span>
    </label>
  );
}

export function RadioGroup(p: { label?: ReactNode; options?: readonly Option[]; value?: string | null; direction?: 'row' | 'column'; onChange?: (v: string) => void }) {
  const name = useUid('rg');
  const [val, setVal] = useSynced(p.value);
  return (
    <fieldset className={cx('bl-fieldset', p.direction === 'row' && 'is-row')}>
      {p.label ? <legend className="bl-label">{p.label}</legend> : null}
      <div className="bl-fieldset-opts">
        {(p.options || []).map((o) => (
          <Radio
            key={o.value}
            name={name}
            value={o.value}
            label={o.label}
            description={o.description}
            checked={o.value === val}
            disabled={o.disabled}
            onChange={(v) => {
              setVal(v);
              p.onChange?.(v);
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}

export function Switch(p: {
  label?: ReactNode;
  description?: ReactNode;
  checked?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  demoState?: string;
  onChange?: (on: boolean) => void;
}) {
  const [on, setOn] = useSynced(!!p.checked);
  const id = useUid('sw');
  return (
    <div className={cx('bl-switch-row', p.disabled && 'is-disabled')}>
      {p.label || p.description ? (
        <label className="bl-check-text bl-grow" htmlFor={id}>
          <span className="bl-check-label">{p.label}</span>
          {p.description ? <span className="bl-check-desc">{p.description}</span> : null}
        </label>
      ) : null}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={p.label ? undefined : p.ariaLabel}
        disabled={p.disabled || undefined}
        className={cx('bl-switch', on && 'is-on', p.demoState && 'is-' + p.demoState)}
        onClick={() => {
          setOn(!on);
          p.onChange?.(!on);
        }}
      >
        <span className="bl-switch-thumb">{on ? <Icon name="check" size={12} stroke={2.5} /> : null}</span>
      </button>
    </div>
  );
}

export function Slider(p: {
  label?: ReactNode;
  value?: Numeric;
  min?: Numeric;
  max?: Numeric;
  step?: Numeric;
  unit?: string;
  lowLabel?: ReactNode;
  highLabel?: ReactNode;
  disabled?: boolean;
  demoState?: string;
  onChange?: (v: number) => void;
}) {
  const min = num(p.min, 0);
  const max = num(p.max, 10);
  const step = num(p.step, 1);
  const [v, setV] = useSynced(num(p.value, min));
  const id = useUid('sl');
  const pct = ((v - min) / (max - min)) * 100;
  return (
    <div className={cx('bl-slider', p.disabled && 'is-disabled')}>
      <div className="bl-slider-head">
        <label className="bl-label" htmlFor={id}>
          {p.label}
        </label>
        <span className="bl-slider-val">
          {fmt(v, 2)}
          {p.unit ? <span className="bl-muted"> {p.unit}</span> : null}
        </span>
      </div>
      <div className="bl-slider-wrap" dir="ltr">
        <div className="bl-slider-track">
          <div className="bl-slider-fill" style={{ width: pct + '%' }} />
        </div>
        <div className={cx('bl-slider-thumb', p.demoState && 'is-' + p.demoState)} style={{ left: pct + '%' }} />
        <input
          id={id}
          type="range"
          className="bl-slider-input"
          min={min}
          max={max}
          step={step}
          value={v}
          disabled={p.disabled || undefined}
          aria-valuetext={fmt(v, 2) + (p.unit ? ' ' + p.unit : '')}
          onChange={(e) => {
            setV(Number(e.target.value));
            p.onChange?.(Number(e.target.value));
          }}
        />
      </div>
      {p.lowLabel || p.highLabel ? (
        <div className="bl-slider-anchors" dir="ltr">
          <span>{p.lowLabel}</span>
          <span>{p.highLabel}</span>
        </div>
      ) : null}
    </div>
  );
}

export function SegmentedControl(p: {
  options?: readonly OptionInput[];
  value?: string | null;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  disabled?: boolean;
  label?: string;
  onChange?: (v: string) => void;
}) {
  const opts = normOptions(p.options);
  const [cur, setCur] = useSynced(p.value !== undefined ? p.value : opts[0] && opts[0].value);
  return (
    <div className={cx('bl-seg', 'bl-seg-' + (p.size || 'md'), p.fullWidth && 'bl-seg-block', p.disabled && 'is-disabled')} role="radiogroup" aria-label={p.label}>
      {opts.map((o) => {
        const on = o.value === cur;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={cx('bl-seg-opt', on && 'is-on')}
            disabled={p.disabled || o.disabled || undefined}
            onClick={() => {
              setCur(o.value);
              p.onChange?.(o.value);
            }}
          >
            {o.icon ? <Icon name={o.icon} size={16} /> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function NumberStepper(p: {
  label?: ReactNode;
  value?: Numeric;
  step?: Numeric;
  min?: Numeric;
  max?: Numeric;
  unit?: ReactNode;
  hint?: ReactNode;
  size?: 'sm' | 'md';
  onChange?: (v: number) => void;
}) {
  const step = num(p.step, 1);
  const [v, setV0] = useSynced(num(p.value, 0));
  const id = useUid('ns');
  const mn = num(p.min, 0);
  const mx = p.max != null ? num(p.max, Infinity) : Infinity;
  const setV = (n: number) => {
    const c = Math.min(mx, Math.max(mn, n));
    setV0(c);
    setDraft(null);
    p.onChange?.(c);
  };
  // Typing keeps a free-form draft (can be emptied, Persian/Arabic digits allowed); it is clamped
  // and committed on blur or Enter, and ↑/↓ step like the buttons.
  const [draft, setDraft] = useState<string | null>(null);
  const parse = (t: string) =>
    Number(
      t
        .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[٫,]/g, '.'),
    );
  const commit = () => {
    if (draft == null) return;
    const n = parse(draft);
    if (draft.trim() === '' || Number.isNaN(n)) setDraft(null);
    else setV(n);
  };
  return (
    <div className={cx('bl-stepper', p.size === 'md' && 'bl-stepper-md')}>
      {p.label ? (
        <label className="bl-label" htmlFor={id}>
          {p.label}
        </label>
      ) : null}
      <div className="bl-stepper-row">
        <button type="button" className="bl-stepper-btn" aria-label={'کاهش ' + step} onClick={() => setV(+(v - step).toFixed(2))}>
          <Icon name="minus" size={22} stroke={2} />
        </button>
        <div className="bl-stepper-val">
          <input
            id={id}
            className="bl-stepper-input"
            inputMode="decimal"
            value={draft ?? String(v)}
            onChange={(e) => {
              const t = e.target.value;
              setDraft(t);
              const n = parse(t);
              // Live-update when the typed number is already valid; out-of-range values wait for blur.
              if (t.trim() !== '' && !Number.isNaN(n) && n >= mn && n <= mx) {
                setV0(n);
                p.onChange?.(n);
              }
            }}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commit();
              else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                setV(+(v + (e.key === 'ArrowUp' ? step : -step)).toFixed(2));
              }
            }}
          />
          {p.unit ? <span className="bl-stepper-unit">{p.unit}</span> : null}
        </div>
        <button type="button" className="bl-stepper-btn" aria-label={'افزایش ' + step} onClick={() => setV(+(v + step).toFixed(2))}>
          <Icon name="plus" size={22} stroke={2} />
        </button>
      </div>
      {p.hint ? <div className="bl-field-msg">{p.hint}</div> : null}
    </div>
  );
}

export function ScaleInput(p: {
  label?: ReactNode;
  value?: Numeric | null;
  min?: Numeric;
  max?: Numeric;
  icon?: IconRef;
  lowLabel?: ReactNode;
  highLabel?: ReactNode;
  size?: 'sm' | 'md';
  onChange?: (v: number | null) => void;
}) {
  const min = num(p.min, 1);
  const max = num(p.max, 10);
  const [v, setV] = useState<number | null>(p.value == null || p.value === '' ? null : num(p.value, 0));
  const id = useUid('sc');
  const opts: number[] = [];
  for (let i = min; i <= max; i++) opts.push(i);
  return (
    <div className={cx('bl-scale', p.size === 'sm' && 'bl-scale-sm')}>
      <div className="bl-scale-head">
        <span className="bl-label" id={id}>
          {p.icon ? <Icon name={p.icon} size={16} /> : null}
          {p.label}
        </span>
        <span className={cx('bl-scale-val', v == null && 'is-nr')}>
          {v == null ? (
            'ثبت نشده'
          ) : (
            <>
              {String(v)}
              <span className="bl-muted"> / {max}</span>
            </>
          )}
        </span>
      </div>
      <div className="bl-scale-opts" role="radiogroup" aria-labelledby={id}>
        {opts.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={o === v}
            className={cx('bl-scale-opt', o === v && 'is-on')}
            onClick={() => {
              const nv = o === v ? null : o;
              setV(nv);
              p.onChange?.(nv);
            }}
          >
            {o}
          </button>
        ))}
      </div>
      <div className="bl-scale-anchors">
        <span>{p.lowLabel || 'Low'}</span>
        <span>{p.highLabel || 'High'}</span>
      </div>
    </div>
  );
}

export interface FileUploadProps {
  label?: ReactNode;
  optional?: boolean;
  state?: 'idle' | 'drag' | 'uploading' | 'done' | 'error' | (string & {});
  title?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  progress?: Numeric;
  fileName?: ReactNode;
  fileMeta?: ReactNode;
  previewInitials?: string;
  previewSrc?: string;
  onBrowse?: () => void;
  onReplace?: () => void;
  onRemove?: () => void;
}

export function FileUpload(p: FileUploadProps) {
  const st = p.state || 'idle';
  return (
    <div className="bl-field">
      {p.label ? (
        <span className="bl-label">
          {p.label}
          {p.optional ? <span className="bl-opt">اختیاری</span> : null}
        </span>
      ) : null}
      {st === 'done' ? (
        <div className="bl-upload-file">
          <div className="bl-upload-thumb">
            {p.previewInitials || p.previewSrc ? <BrandMark initials={p.previewInitials} src={p.previewSrc} variant="mark" size="md" /> : <Icon name="image" size={18} />}
          </div>
          <div className="bl-grow bl-minw0">
            <div className="bl-upload-name">{p.fileName}</div>
            <div className="bl-muted bl-small">{p.fileMeta}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={p.onReplace}>
            جایگزینی
          </Button>
          <IconButton icon="trash" label="حذف فایل" size="sm" onClick={p.onRemove} />
        </div>
      ) : (
        <div className={cx('bl-upload', st === 'error' && 'is-error', st === 'drag' && 'is-drag')}>
          <Icon name="upload" size={22} />
          <div className="bl-upload-t">
            {(p.title || 'فایل را اینجا رها کنید یا') + ' '}
            <button type="button" className="bl-link-btn" onClick={p.onBrowse}>
              انتخاب فایل
            </button>
          </div>
          {p.hint ? <div className="bl-muted bl-small">{p.hint}</div> : null}
          {st === 'uploading' ? (
            <div style={{ width: '100%' }}>
              <ProgressBar value={num(p.progress, 40)} label="در حال بارگذاری" size="sm" />
            </div>
          ) : null}
        </div>
      )}
      {p.error ? (
        <div className="bl-field-msg bl-field-error">
          <Icon name="alert-circle" size={14} stroke={2} />
          {p.error}
        </div>
      ) : null}
    </div>
  );
}

export interface ContrastCheck {
  label: ReactNode;
  status?: 'pass' | 'fail' | 'fixed';
  ratio?: ReactNode;
}

export function BrandColorField(p: { label?: string; value?: string; checks?: ContrastCheck[]; hint?: ReactNode; onChange?: (hex: string) => void }) {
  const hex = (p.value || '').replace('#', '').toUpperCase();
  const [cur, setCur] = useState(hex);
  const valid = /^[0-9A-F]{6}$/.test(cur);
  const checks = p.checks || [];
  return (
    <div className="bl-field bl-colorfield">
      <span className="bl-label">{p.label}</span>
      <div className="bl-colorfield-row">
        <span className="bl-swatch" style={{ background: valid ? '#' + cur : p.value }} aria-hidden="true" />
        <div className="bl-input bl-grow">
          <span className="bl-affix">#</span>
          <input
            className="bl-input-el bl-mono"
            value={cur}
            maxLength={6}
            onChange={(e) => {
              const v = e.target.value
                .replace(/[^0-9a-fA-F]/g, '')
                .toUpperCase()
                .slice(0, 6);
              setCur(v);
              if (p.onChange && /^[0-9A-F]{6}$/.test(v)) p.onChange('#' + v);
            }}
            aria-label={p.label + ', hex value'}
          />
        </div>
      </div>
      {checks.length ? (
        <ul className="bl-checks">
          {checks.map((c, i) => {
            const s = c.status || 'pass';
            return (
              <li key={i} className={'bl-checkline is-' + s}>
                <Icon name={s === 'fail' ? 'x-circle' : s === 'fixed' ? 'refresh' : 'check-circle'} size={16} stroke={2} />
                <span className="bl-grow">{c.label}</span>
                {c.ratio ? <span className="bl-mono bl-checkline-r">{c.ratio}</span> : null}
                <span className="bl-checkline-s">{s === 'fail' ? 'رد AA' : s === 'fixed' ? 'تنظیم خودکار' : 'قبول AA'}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {p.hint ? <div className="bl-field-msg">{p.hint}</div> : null}
    </div>
  );
}

export function DatePicker(
  p: FieldBase & {
    value?: string;
    placeholder?: string;
    open?: boolean;
    disabled?: boolean;
    month?: string;
    startOffset?: Numeric;
    daysInMonth?: Numeric;
    today?: Numeric;
    selected?: Numeric;
  },
) {
  const id = useUid('dp');
  const box = (
    <div className="bl-select-wrap">
      <button
        id={id}
        type="button"
        className={cx('bl-input', 'bl-select', p.open && 'is-focus', !!p.error && 'is-error', p.disabled && 'is-disabled')}
        aria-haspopup="dialog"
        aria-expanded={!!p.open}
        disabled={p.disabled || undefined}
      >
        <Icon name="calendar" size={18} className="bl-input-icon" />
        <span className={cx('bl-select-val', !p.value && 'is-placeholder')}>{p.value || p.placeholder || 'انتخاب تاریخ'}</span>
      </button>
      {p.open ? (
        <div className="bl-popover" role="dialog" aria-label="انتخاب تاریخ">
          <Calendar month={p.month} startOffset={p.startOffset} daysInMonth={p.daysInMonth} today={p.today} selected={p.selected} size="sm" />
        </div>
      ) : null}
    </div>
  );
  return Field(p, box, id);
}
