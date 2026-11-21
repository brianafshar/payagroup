import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLang } from "../i18n";

/**
 * Horizontal pages. Desktop: the vertical wheel / trackpad / keys / arrows move sideways with eased motion
 * and settle on a page. Touch: native swipe with CSS scroll-snap.
 * Pages flow right → left in Persian (RTL) and left → right in English.
 */
export default function HScroll({ children }: { children: ReactNode }) {
  const lang = useLang();
  const dir = lang === "fa" ? -1 : 1;
  const ref = useRef<HTMLDivElement>(null);
  const go = useRef<(px: number) => void>(() => {});
  const [active, setActive] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const el = ref.current!;
    const coarse = window.matchMedia("(pointer: coarse), (max-width: 800px)");
    el.scrollLeft = 0;
    let target = 0, cur = 0, raf = 0, snapT = 0;
    const max = () => el.scrollWidth - el.clientWidth;

    const loop = () => {
      cur += (target - cur) * 0.085;
      if (Math.abs(target - cur) < 0.5) { cur = target; el.scrollLeft = dir * cur; raf = 0; return; }
      el.scrollLeft = dir * cur;
      raf = requestAnimationFrame(loop);
    };
    const moveTo = (px: number) => {
      const t = Math.max(0, Math.min(max(), px));
      if (coarse.matches) { el.scrollTo({ left: dir * t, behavior: "smooth" }); return; }
      target = t;
      if (!raf) { cur = Math.abs(el.scrollLeft); raf = requestAnimationFrame(loop); }
    };
    go.current = moveTo;
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };

    const nearest = () => {
      const er = el.getBoundingClientRect();
      let best: HTMLElement | null = null, bestOv = -1;
      Array.from(el.firstElementChild!.children).forEach((c) => {
        const r = c.getBoundingClientRect();
        const ov = Math.min(r.right, er.right) - Math.max(r.left, er.left);
        if (ov > bestOv) { bestOv = ov; best = c as HTMLElement; }
      });
      return { p: best as HTMLElement | null, er };
    };
    const snap = () => {
      const { p, er } = nearest();
      if (!p || p.offsetWidth > el.clientWidth * 1.05) return; // wide panels scroll freely
      moveTo(Math.abs(el.scrollLeft + p.getBoundingClientRect().left - er.left));
    };

    const onWheel = (e: WheelEvent) => {
      if (coarse.matches || e.ctrlKey) return;
      const panel = (e.target as HTMLElement).closest<HTMLElement>(".panel");
      if (panel && panel.scrollHeight > panel.clientHeight + 2) {
        const atEnd = e.deltaY > 0 ? panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 2 : panel.scrollTop <= 0;
        if (!atEnd) return;
      }
      e.preventDefault();
      if (!raf) { cur = Math.abs(el.scrollLeft); target = cur; }
      moveTo(target + (e.deltaY + e.deltaX) * 1.1);
      clearTimeout(snapT);
      snapT = window.setTimeout(snap, 220);
    };

    const onScroll = () => {
      el.style.setProperty("--sx", String(el.scrollLeft));
      const { p } = nearest();
      if (p) setActive(Array.from(el.firstElementChild!.children).indexOf(p));
    };

    const onKey = (e: KeyboardEvent) => {
      if (coarse.matches || (e.target as HTMLElement).closest("input, textarea, select")) return;
      let d = 0;
      if (["ArrowDown", "PageDown", " "].includes(e.key)) d = 1;
      else if (["ArrowUp", "PageUp"].includes(e.key)) d = -1;
      if (e.key === "ArrowLeft") d = dir === -1 ? 1 : -1; // RTL: next page is on the left
      if (e.key === "ArrowRight") d = dir === -1 ? -1 : 1;
      if (!d) return;
      e.preventDefault();
      jumpBy(d);
    };
    const jumpBy = (d: number) => {
      const kids = Array.from(el.firstElementChild!.children);
      const { p } = nearest();
      const i = Math.max(0, Math.min(kids.length - 1, (p ? kids.indexOf(p) : 0) + d));
      const er = el.getBoundingClientRect();
      moveTo(Math.abs(el.scrollLeft + kids[i].getBoundingClientRect().left - er.left));
    };

    const mouseDown = (e: MouseEvent) => {
      if (coarse.matches || e.button !== 0) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, button, a, [data-nodrag]")) return;

      stop(); // cancel any running easing
      const kids = Array.from(el.firstElementChild!.children);
      const startIdx = Math.max(0, kids.indexOf(nearest().p as HTMLElement));
      const startX = e.clientX;
      const startPos = Math.abs(el.scrollLeft);
      let moved = false, lastX = startX, lastT = performance.now(), v = 0;

      const onMove = (ev: MouseEvent) => {
        const dx = ev.clientX - startX;
        if (!moved) {
          if (Math.abs(dx) < 4) return; // small threshold so normal clicks still work
          moved = true;
          el.classList.add("dragging");
          window.getSelection()?.removeAllRanges();
        }
        const now = performance.now();
        const dt = now - lastT;
        if (dt > 0) v = 0.8 * v + 0.2 * ((ev.clientX - lastX) / dt); // px/ms, smoothed
        lastX = ev.clientX;
        lastT = now;

        // content follows the cursor; in RTL the scroll axis is inverted
        cur = target = Math.max(0, Math.min(max(), startPos - dir * dx));
        el.scrollLeft = dir * cur;
      };

      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        el.classList.remove("dragging");
        if (!moved) return;

        // swallow the click that follows a drag
        const block = (ev: MouseEvent) => { ev.stopPropagation(); ev.preventDefault(); };
        window.addEventListener("click", block, { capture: true, once: true });
        setTimeout(() => window.removeEventListener("click", block, true), 0);

        if (performance.now() - lastT > 80) v = 0; // held still before release → no flick
        if (Math.abs(v) > 0.5) {
          const d = -dir * Math.sign(v);
          const i = Math.max(0, Math.min(kids.length - 1, startIdx + d));
          const er = el.getBoundingClientRect();
          moveTo(Math.abs(el.scrollLeft + kids[i].getBoundingClientRect().left - er.left));
        } else {
          snap(); // settle on nearest page
        }
      };

      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    };

    setTotal(el.firstElementChild!.children.length);
    onScroll();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("mousedown", mouseDown)
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(snapT);
      stop();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("mousedown", mouseDown);
    };
  }, [dir]);

  const jump = useCallback((i: number) => {
    const el = ref.current!;
    const kids = el.firstElementChild!.children;
    const p = kids[Math.max(0, Math.min(kids.length - 1, i))] as HTMLElement;
    go.current(Math.abs(el.scrollLeft + p.getBoundingClientRect().left - el.getBoundingClientRect().left));
  }, []);

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
        <button className="va" onClick={() => jump(active - 1)} disabled={active === 0} aria-label="previous page">{chevron(true)}</button>
        <ul className="ticks">
          {Array.from({ length: total }).map((_, i) => (
            <li key={i} className={i === active ? "on" : ""}>
              {i === active && <span className="tn">{num(i + 1)}</span>}
              <button onClick={() => jump(i)} aria-label={`page ${i + 1}`} />
            </li>
          ))}
        </ul>
        <button className="va" onClick={() => jump(active + 1)} disabled={active >= total - 1} aria-label="next page">{chevron(false)}</button>
      </div>
    </>
  );
}
