import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLang } from "../i18n";

/**
 * Horizontal page: vertical wheel / trackpad / keys move sideways with smooth easing.
 * Panels flow right → left in Persian (RTL) and left → right in English.
 * On narrow screens it falls back to normal vertical scrolling.
 */
export default function HScroll({ children }: { children: ReactNode }) {
  const lang = useLang();
  const dir = lang === "fa" ? -1 : 1;
  const ref = useRef<HTMLDivElement>(null);
  const go = useRef<(px: number) => void>(() => {});
  const [active, setActive] = useState(0);
  const [total, setTotal] = useState(0);
  const [prog, setProg] = useState(0);

  useEffect(() => {
    const el = ref.current!;
    const mq = window.matchMedia("(max-width: 800px)");
    el.scrollLeft = 0;
    let target = 0, cur = 0, raf = 0;
    const max = () => el.scrollWidth - el.clientWidth;

    const loop = () => {
      cur += (target - cur) * 0.085;
      if (Math.abs(target - cur) < 0.5) { cur = target; el.scrollLeft = dir * cur; raf = 0; return; }
      el.scrollLeft = dir * cur;
      raf = requestAnimationFrame(loop);
    };
    const moveTo = (px: number) => {
      if (!raf) cur = Math.abs(el.scrollLeft);
      target = Math.max(0, Math.min(max(), px));
      if (!raf) raf = requestAnimationFrame(loop);
    };
    go.current = moveTo;

    const onWheel = (e: WheelEvent) => {
      if (mq.matches || e.ctrlKey) return;
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
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    let snapT = 0;
    const snap = () => {
      const er = el.getBoundingClientRect();
      let best: HTMLElement | null = null, bestOv = -1;
      Array.from(el.firstElementChild!.children).forEach((c) => {
        const r = c.getBoundingClientRect();
        const ov = Math.min(r.right, er.right) - Math.max(r.left, er.left);
        if (ov > bestOv) { bestOv = ov; best = c as HTMLElement; }
      });
      const p = best as HTMLElement | null;
      if (!p || p.offsetWidth > el.clientWidth * 1.05) return; // wide panels scroll freely
      moveTo(Math.abs(el.scrollLeft + p.getBoundingClientRect().left - er.left));
    };

    const onScroll = () => {
      el.style.setProperty("--sx", String(el.scrollLeft));
      const m = max();
      setProg(m > 0 ? Math.abs(el.scrollLeft) / m : 0);
      const er = el.getBoundingClientRect();
      let best = 0, bestOv = -1;
      Array.from(el.firstElementChild!.children).forEach((c, i) => {
        const r = c.getBoundingClientRect();
        const ov = Math.min(r.right, er.right) - Math.max(r.left, er.left);
        if (ov > bestOv) { bestOv = ov; best = i; }
      });
      setActive(best);
    };

    const onKey = (e: KeyboardEvent) => {
      if (mq.matches || (e.target as HTMLElement).closest("input, textarea, select")) return;
      const fwd = ["ArrowDown", "PageDown", " "];
      const back = ["ArrowUp", "PageUp"];
      const side = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
      const step = el.clientWidth * 0.8;
      let d = 0;
      if (fwd.includes(e.key)) d = 1;
      else if (back.includes(e.key)) d = -1;
      else if (side) d = side * -dir; // next panel is on the left in RTL
      if (!d) return;
      e.preventDefault();
      if (!raf) { cur = Math.abs(el.scrollLeft); target = cur; }
      moveTo(target + d * step);
    };

    setTotal(el.firstElementChild!.children.length);
    onScroll();
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", stop, { passive: true });
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(snapT);
      stop();
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", stop);
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("keydown", onKey);
    };
  }, [dir]);

  const jump = useCallback((i: number) => {
    const el = ref.current!;
    const panels = el.firstElementChild!.children;
    const p = panels[Math.max(0, Math.min(panels.length - 1, i))] as HTMLElement;
    const delta = p.getBoundingClientRect().left - el.getBoundingClientRect().left;
    go.current(Math.abs(el.scrollLeft + delta));
  }, []);

  const num = (n: number) => (lang === "fa" ? String(n).padStart(2, "0").replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[+d]) : String(n).padStart(2, "0"));

  return (
    <>
      <div className="hs" ref={ref}>
        <div className="hs-track">{children}</div>
      </div>
      <div className="hud" aria-hidden={false}>
        <button onClick={() => jump(active - 1)} disabled={active === 0} aria-label="prev">{lang === "fa" ? "→" : "←"}</button>
        <span className="hud-n">{num(active + 1)} <i>/ {num(total)}</i></span>
        <button onClick={() => jump(active + 1)} disabled={active >= total - 1} aria-label="next">{lang === "fa" ? "←" : "→"}</button>
      </div>
      <div className="progress"><span style={{ transform: `scaleX(${prog})` }} /></div>
    </>
  );
}
