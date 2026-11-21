import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLang } from "../i18n";

/**
 * Horizontal pages.
 * Desktop: one wheel/trackpad gesture, key press, arrow click or mouse drag = exactly one page, with a timed ease.
 * The last page wraps back to the first. Touch: native swipe with CSS scroll-snap.
 * Pages flow right → left in Persian (RTL) and left → right in English.
 */
export default function HScroll({ children }: { children: ReactNode }) {
  const lang = useLang();
  const dir = lang === "fa" ? -1 : 1;
  const ref = useRef<HTMLDivElement>(null);
  const api = useRef<{ toPanel: (i: number) => void; step: (d: 1 | -1, wrap: boolean) => void }>({ toPanel: () => {}, step: () => {} });
  const [active, setActive] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const el = ref.current!;
    const track = el.firstElementChild as HTMLElement;
    const coarse = window.matchMedia("(pointer: coarse), (max-width: 800px)");
    el.scrollLeft = 0;

    let anim = 0, locked = false, lockUntil = 0, lastWheel = 0, wrapTimer = 0;
    const px = () => dir * el.scrollLeft; // distance travelled "forward", always ≥ 0
    const maxPx = () => el.scrollWidth - el.clientWidth;
    const setPx = (v: number) => { el.scrollLeft = dir * v; };

    /** Every position the view may rest on: each panel start, plus extra steps inside panels wider than the screen. */
    const stops = () => {
      const er = el.getBoundingClientRect();
      const sl = el.scrollLeft, w = el.clientWidth, m = maxPx();
      const out: number[] = [];
      Array.from(track.children).forEach((c) => {
        const r = c.getBoundingClientRect();
        const pL = dir * (sl + r.left - er.left);
        const pR = dir * (sl + r.right - er.right);
        const wide = r.width > w * 1.05;
        const first = wide && dir < 0 ? pR : pL;
        const last = wide ? (dir < 0 ? pL : pR) : pL;
        out.push(first);
        if (wide) { for (let x = first + w * 0.85; x < last - w * 0.2; x += w * 0.85) out.push(x); out.push(last); }
      });
      const clamped = out.map((v) => Math.max(0, Math.min(m, Math.round(v)))).sort((a, b) => a - b);
      return clamped.filter((v, i) => i === 0 || v - clamped[i - 1] > 2);
    };

    const tween = (target: number) => {
      cancelAnimationFrame(anim);
      const from = px();
      const dist = Math.abs(target - from);
      if (dist < 1) return;
      const dur = Math.min(1100, Math.max(650, 500 + dist * 0.16));
      const t0 = performance.now();
      locked = true;
      const frame = (t: number) => {
        const k = Math.min(1, (t - t0) / dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // easeInOutCubic
        setPx(from + (target - from) * e);
        if (k < 1) anim = requestAnimationFrame(frame);
        else { locked = false; lockUntil = performance.now() + 120; }
      };
      anim = requestAnimationFrame(frame);
    };

    const goTo = (target: number) => {
      if (coarse.matches) { el.scrollTo({ left: dir * target, behavior: "smooth" }); return; }
      tween(target);
    };

    /** Fade out, jump to the first page, fade in (used when going forward from the last page). */
    const wrapToStart = () => {
      if (coarse.matches) { el.scrollTo({ left: 0, behavior: "smooth" }); return; }
      locked = true;
      el.classList.add("fading");
      wrapTimer = window.setTimeout(() => {
        setPx(0);
        el.classList.remove("fading");
        wrapTimer = window.setTimeout(() => { locked = false; lockUntil = performance.now() + 100; }, 300);
      }, 280);
    };

    const step = (d: 1 | -1, wrap: boolean, from = px()) => {
      const s = stops();
      if (d > 0) {
        const next = s.find((v) => v > from + 4);
        if (next !== undefined) goTo(next);
        else if (wrap) wrapToStart();
      } else {
        const prev = [...s].reverse().find((v) => v < from - 4);
        if (prev !== undefined) goTo(prev);
      }
    };

    const panelStart = (i: number) => {
      const kids = Array.from(track.children);
      const c = kids[Math.max(0, Math.min(kids.length - 1, i))] as HTMLElement;
      const er = el.getBoundingClientRect(), r = c.getBoundingClientRect();
      const w = el.clientWidth;
      const pL = dir * (el.scrollLeft + r.left - er.left);
      const pR = dir * (el.scrollLeft + r.right - er.right);
      const wide = r.width > w * 1.05;
      return Math.max(0, Math.min(maxPx(), Math.round(wide && dir < 0 ? pR : pL)));
    };
    const toPanel = (i: number) => {
      if (locked) return;
      goTo(panelStart(i));
    };
    api.current = {
      toPanel,
      step: (d, wrap) => { if (!locked && performance.now() >= lockUntil) step(d, wrap); },
    };

    // ----- wheel: one gesture = one page -----
    const onWheel = (e: WheelEvent) => {
      if (coarse.matches || e.ctrlKey) return;
      const panel = (e.target as HTMLElement).closest<HTMLElement>(".panel");
      if (panel && panel.scrollHeight > panel.clientHeight + 2) {
        const atEnd = e.deltaY > 0 ? panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2 : panel.scrollTop <= 0;
        if (!atEnd) return; // let a tall panel scroll vertically first
      }
      e.preventDefault();
      const now = performance.now();
      const gap = now - lastWheel;
      lastWheel = now;
      const d = e.deltaY + e.deltaX;
      if (locked || now < lockUntil || Math.abs(d) < 4) return;
      if (gap < 150 && Math.abs(d) < 40) return; // tail of trackpad inertia
      step(d > 0 ? 1 : -1, true);
    };

    // ----- keys -----
    const onKey = (e: KeyboardEvent) => {
      if (coarse.matches || (e.target as HTMLElement).closest("input, textarea, select, summary")) return;
      let d = 0;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) d = 1;
      else if (["ArrowUp", "PageUp"].includes(e.key)) d = -1;
      else if (e.key === "ArrowLeft") d = dir < 0 ? 1 : -1;
      else if (e.key === "ArrowRight") d = dir < 0 ? -1 : 1;
      else if (e.key === "Home") { e.preventDefault(); toPanel(0); return; }
      if (!d) return;
      e.preventDefault();
      if (!locked && performance.now() >= lockUntil) step(d as 1 | -1, true);
    };

    // ----- mouse drag: click, push, release → next/previous -----
    let drag: { x: number; y: number; px0: number; t: number; id: number; on: boolean } | null = null;
    let justDragged = false;
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || coarse.matches || locked) return;
      if ((e.target as HTMLElement).closest("button, input, textarea, select, summary, video, iframe")) return;
      drag = { x: e.clientX, y: e.clientY, px0: px(), t: performance.now(), id: e.pointerId, on: false };
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      if (!drag.on) {
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(e.clientY - drag.y)) return;
        drag.on = true;
        el.setPointerCapture(drag.id);
        el.classList.add("dragging");
        cancelAnimationFrame(anim);
      }
      setPx(Math.max(0, Math.min(maxPx(), drag.px0 - dir * dx)));
    };
    const onUp = (e: PointerEvent) => {
      if (!drag) return;
      const d = drag; drag = null;
      if (!d.on) return;
      el.classList.remove("dragging");
      try { el.releasePointerCapture(d.id); } catch { /* already released */ }
      justDragged = true;
      setTimeout(() => { justDragged = false; }, 50);
      const dx = e.clientX - d.x;
      const forward = -dir * dx > 0;
      const fast = Math.abs(dx) / Math.max(1, performance.now() - d.t) > 0.5;
      const s = stops();
      if (Math.abs(dx) > Math.min(90, el.clientWidth * 0.08) || fast) {
        const target = forward ? s.find((v) => v > d.px0 + 4) : [...s].reverse().find((v) => v < d.px0 - 4);
        if (target !== undefined) { tween(target); return; }
      }
      const back = s.reduce((a, v) => (Math.abs(v - d.px0) < Math.abs(a - d.px0) ? v : a), s[0] ?? 0);
      tween(back);
    };
    const onClickCapture = (e: MouseEvent) => { if (justDragged) { e.preventDefault(); e.stopPropagation(); } };
    const onDragStart = (e: Event) => e.preventDefault();

    // ----- bookkeeping for the indicator -----
    const onScroll = () => {
      el.style.setProperty("--sx", String(el.scrollLeft));
      const er = el.getBoundingClientRect();
      let best = 0, bestOv = -1;
      Array.from(track.children).forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const ov = Math.min(r.right, er.right) - Math.max(r.left, er.left);
        if (ov > bestOv) { bestOv = ov; best = i; }
      });
      setActive(best);
    };

    setTotal(track.children.length);
    onScroll();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("click", onClickCapture, true);
    el.addEventListener("dragstart", onDragStart);
    window.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(anim);
      clearTimeout(wrapTimer);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("click", onClickCapture, true);
      el.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("keydown", onKey);
    };
  }, [dir]);

  const prev = useCallback(() => api.current.step(-1, false), []);
  const next = useCallback(() => api.current.step(1, true), []);
  const to = useCallback((i: number) => api.current.toPanel(i), []);

  const num = (n: number) => (lang === "fa" ? String(n).padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]) : String(n).padStart(2, "0"));
  const chevron = (up: boolean) => (
    <svg width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <path d={up ? "M1 7l5-5 5 5" : "M1 1l5 5 5-5"} />
    </svg>
  );

  return (
    <>
      <div className="hs" ref={ref}>
        <div className="hs-track">{children}</div>
      </div>
      <div className="vind">
        <button className="va" onClick={prev} disabled={active === 0} aria-label="previous page">{chevron(true)}</button>
        <ul className="ticks">
          {Array.from({ length: total }).map((_, i) => (
            <li key={i} className={i === active ? "on" : ""}>
              {i === active && <span className="tn">{num(i + 1)}</span>}
              <button onClick={() => to(i)} aria-label={`page ${i + 1}`} />
            </li>
          ))}
        </ul>
        <button className="va" onClick={next} aria-label={active >= total - 1 ? "back to the first page" : "next page"}>{chevron(false)}</button>
      </div>
    </>
  );
}
