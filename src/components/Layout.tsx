import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useLang } from "../i18n";
import Nav from "./Nav";
import Footer from "./Footer";

export default function Layout() {
  const lang = useLang();
  const { pathname } = useLocation();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "fa" ? "rtl" : "ltr";
  }, [lang]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.12 },
    );
    const t = setTimeout(() => document.querySelectorAll("[data-reveal]:not(.in)").forEach((el) => io.observe(el)), 50);
    return () => { clearTimeout(t); io.disconnect(); };
  }, [pathname]);

  return (
    <>
      <Nav />
      <div className="wipe" key={`w${pathname}`} aria-hidden />
      <main className="page" key={pathname}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
