import type { ReactNode } from "react";

export function Panel({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section className={`panel ${className}`} id={id}>{children}</section>;
}

export function PanelHead({ n, title }: { n?: string; title: string }) {
  return (
    <div className="phead" data-reveal>
      {n && <span className="pn">{n}</span>}
      <h2>{title}</h2>
    </div>
  );
}
