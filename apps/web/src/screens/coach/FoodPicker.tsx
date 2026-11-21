// Food bank inputs for the nutrition plan: a name field that suggests foods from the bank as you type, and a
// small form for adding the coach's own food (with its units) when it isn't there.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button, Icon, Modal, TextField } from '@/ds';
import { faError, remote } from '@/data/api';
import type { BankFood } from '@/data/remote';
import { categoryIcon, foodIcon } from '@/lib/foodIcons';
import { useQuery } from '@/data/hooks';
import { toast } from '@/lib/toast';

const fa = (v: number | string) =>
  String(v)
    .replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d])
    .replace('.', '٫');
const en = (s: string) =>
  +String(s ?? '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace('٫', '.')
    .replace(/[^\d.]/g, '') || 0;

export const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  height: '34px',
  padding: '0 10px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  background: 'var(--surface)',
  color: 'var(--text-primary)',
  font: "400 14px/20px 'Vazirmatn',sans-serif",
};

/** Browse the food bank as cards: category cards first (breakfast, Iranian dishes, stews…), then the foods in it. */
export function FoodBrowser({ onPick, onClose }: { onPick: (f: BankFood) => void; onClose: () => void }) {
  const cats = useQuery<Array<{ category: string; count: number }>>('food-cats', () => remote.foodCategories());
  const [cat, setCat] = useState<string | null>(null);
  const foods = useQuery<BankFood[]>('foods-cat:' + (cat ?? ''), () => (cat ? remote.foodsByCategory(cat) : Promise.resolve([])));
  const card: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    padding: 12,
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    font: "500 13px/20px 'Vazirmatn',sans-serif",
    color: 'var(--text-primary)',
    textAlign: 'center',
  };
  return (
    <div role="dialog" aria-label="بانک غذا" style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} style={{ width: 'min(860px, 100%)', maxHeight: '88vh', overflow: 'auto', background: 'var(--surface-raised, var(--surface))', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {cat ? (
            <Button variant="ghost" size="sm" icon="arrow-right" onClick={() => setCat(null)}>
              دسته‌ها
            </Button>
          ) : null}
          <h3 style={{ margin: 0, flex: 1, fontSize: 16 }}>{cat ?? 'بانک غذا — یک دسته را انتخاب کنید'}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            بستن
          </Button>
        </div>
        {!cat ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: 10 }}>
            {(cats.data ?? []).map((c) => (
              <button key={c.category} type="button" style={card} onClick={() => setCat(c.category)}>
                <img src={categoryIcon(c.category)} alt="" width={56} height={56} />
                <span>{c.category}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fa(c.count)} غذا</span>
              </button>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
            {foods.loading ? <span>در حال بارگذاری…</span> : null}
            {(foods.data ?? []).map((f) => (
              <button key={f.id} type="button" style={card} onClick={() => onPick(f)}>
                <img src={foodIcon(f.name, f.category)} alt="" width={56} height={56} loading="lazy" />
                <span>{f.name}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fa(Math.round(f.kcalPer100g)) + ' kcal / ۱۰۰g'}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Name input with food-bank suggestions. Typing keeps it a hand-typed food; picking a suggestion calls `onPick`. */
export function FoodNameInput({
  value,
  onChange,
  onPick,
  onCreate,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (f: BankFood) => void;
  onCreate: (name: string) => void;
}) {
  const [list, setList] = useState<BankFood[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const typed = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const [browsing, setBrowsing] = useState(false);

  useEffect(() => {
    const q = value.trim();
    if (!typed.current || !q) {
      setList([]);
      return;
    }
    let live = true;
    const t = setTimeout(() => {
      remote
        .foods(q)
        .then((rows) => {
          if (!live) return;
          setList(rows.slice(0, 8));
          setHi(0);
          place();
          setOpen(true);
        })
        .catch(() => {});
    }, 180);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // The list sits on a fixed layer (meal cards clip overflow); it closes when the page scrolls.
  function place() {
    const r = input.current?.getBoundingClientRect();
    if (r) setPos({ left: r.left, top: r.bottom + 4, width: Math.max(r.width, 340) });
  }
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  const pick = (f: BankFood) => {
    typed.current = false;
    setOpen(false);
    onPick(f);
  };
  const items = list.length + 1; // + «add as my food»
  return (
    <div ref={box} style={{ position: 'relative', minWidth: 0, display: 'flex', gap: 4 }}>
      {browsing ? (
        <FoodBrowser
          onPick={(f) => {
            setBrowsing(false);
            pick(f);
          }}
          onClose={() => setBrowsing(false)}
        />
      ) : null}
      <button type="button" aria-label="مرور بانک غذا" title="مرور بانک غذا" onClick={() => setBrowsing(true)} style={{ ...inputStyle, width: 34, flex: '0 0 34px', padding: 0, cursor: 'pointer' }}>
        <Icon name="library" size={16} />
      </button>
      <input
        value={value}
        placeholder="جستجو در بانک غذا، مثلاً سفیده"
        aria-label="نام غذا"
        aria-autocomplete="list"
        aria-expanded={open}
        onChange={(e) => {
          typed.current = true;
          onChange(e.target.value);
        }}
        ref={input}
        onFocus={() => {
          if (!list.length) return;
          place();
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHi((h) => (h + 1) % items);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHi((h) => (h - 1 + items) % items);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (hi < list.length) pick(list[hi]);
            else {
              setOpen(false);
              onCreate(value.trim());
            }
          } else if (e.key === 'Escape') setOpen(false);
        }}
        style={{ ...inputStyle, flex: 1, minWidth: 0 }}
      />
      {open && value.trim() && pos ? (
        <div
          role="listbox"
          className="bl-menu"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left + (input.current?.offsetWidth ?? 0) - pos.width,
            width: pos.width,
            zIndex: 90,
            maxHeight: 340,
            overflowY: 'auto',
            padding: 4,
          }}
        >
          {list.map((f, i) => (
            <button
              key={f.id}
              type="button"
              role="option"
              aria-selected={i === hi}
              className="bl-menu-item"
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(f)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: i === hi ? 'var(--surface-sunken)' : undefined }}
            >
              <span style={{ flex: 1, minWidth: 0, textAlign: 'start', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name}
                {f.mine ? <span style={{ fontSize: 11, color: 'var(--brand-primary-text)', marginInlineStart: 6 }}>غذای من</span> : null}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{fa(Math.round(f.kcalPer100g)) + ' kcal / ۱۰۰g'}</span>
            </button>
          ))}
          {!list.length ? <div style={{ padding: '8px 10px', fontSize: 13, color: 'var(--text-muted)' }}>در بانک غذا پیدا نشد.</div> : null}
          <button
            type="button"
            className="bl-menu-item"
            aria-selected={hi === list.length}
            onMouseEnter={() => setHi(list.length)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setOpen(false);
              onCreate(value.trim());
            }}
            style={{ width: '100%', color: 'var(--brand-primary-text)', background: hi === list.length ? 'var(--surface-sunken)' : undefined }}
          >
            <Icon name="plus" size={16} />
            {'افزودن «' + value.trim() + '» به غذاهای من'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** The coach's own food: per-100 g values and how many grams each household unit is. */
export function CustomFoodModal({ name, onSaved, onClose }: { name: string; onSaved: (f: BankFood) => void; onClose: () => void }) {
  const [f, setF] = useState({ name, category: '', kcal: '', p: '', c: '', fat: '' });
  const [units, setUnits] = useState([{ unit: 'عدد', grams: '' }]);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const valid = f.name.trim() && en(f.kcal) >= 0 && f.kcal !== '' && units.every((u) => !u.unit.trim() || en(u.grams) > 0);
  const save = async () => {
    setBusy(true);
    try {
      const real = units.filter((u) => u.unit.trim() && en(u.grams) > 0).map((u) => ({ unit: u.unit.trim(), grams: en(u.grams) }));
      const food = await remote.createFood({
        name: f.name.trim(),
        category: f.category.trim(),
        kcalPer100g: en(f.kcal),
        proteinPer100g: en(f.p),
        carbsPer100g: en(f.c),
        fatPer100g: en(f.fat),
        defaultUnit: real[0]?.unit || 'گرم',
        units: real.length ? real : [{ unit: 'گرم', grams: 1 }],
      });
      toast('به غذاهای شما اضافه شد', food.name);
      onSaved(food);
    } catch (e) {
      toast('ذخیره نشد', faError(e), 'error');
      setBusy(false);
    }
  };
  return (
    <Modal
      title="افزودن غذای جدید"
      description="فقط شما این غذا را در بانک غذا می‌بینید. مقادیر به ازای ۱۰۰ گرم است."
      primaryLabel="افزودن"
      primaryDisabled={!valid}
      loading={busy}
      secondaryLabel="انصراف"
      onPrimary={save}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextField label="نام غذا" value={f.name} onChange={set('name')} />
        <TextField label="دسته (اختیاری)" value={f.category} placeholder="مثلاً مکمل" onChange={set('category')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 8 }}>
          <TextField label="کالری" suffix="kcal" inputMode="decimal" value={f.kcal} onChange={set('kcal')} />
          <TextField label="پروتئین" suffix="g" inputMode="decimal" value={f.p} onChange={set('p')} />
          <TextField label="کربوهیدرات" suffix="g" inputMode="decimal" value={f.c} onChange={set('c')} />
          <TextField label="چربی" suffix="g" inputMode="decimal" value={f.fat} onChange={set('fat')} />
        </div>
        <strong style={{ fontSize: 14 }}>واحدها</strong>
        <span style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: -8 }}>هر واحد چند گرم است؟ واحد اول پیش‌فرض است. «گرم» همیشه اضافه می‌شود.</span>
        {units.map((u, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 120px 32px', gap: 8, alignItems: 'center' }}>
            <input
              aria-label="نام واحد"
              placeholder="مثلاً عدد، قاشق"
              value={u.unit}
              onChange={(e) => setUnits((l) => l.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}
              style={inputStyle}
            />
            <input
              aria-label="گرم"
              placeholder="گرم"
              inputMode="decimal"
              value={u.grams}
              onChange={(e) => setUnits((l) => l.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))}
              style={inputStyle}
            />
            <button
              type="button"
              title="حذف واحد"
              onClick={() => setUnits((l) => l.filter((_, j) => j !== i))}
              style={{ border: 0, background: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
            >
              ×
            </button>
          </div>
        ))}
        <div>
          <Button size="sm" variant="ghost" icon="plus" onClick={() => setUnits((l) => [...l, { unit: '', grams: '' }])}>
            واحد دیگر
          </Button>
        </div>
      </div>
    </Modal>
  );
}
