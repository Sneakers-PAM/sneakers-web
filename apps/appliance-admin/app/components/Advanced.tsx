import type { ReactNode } from "react";

/**
 * The "Advanced" disclosure: trust/PKI details, add-on modules and the support bundle sit
 * behind it, collapsed by default. A native `<details>` needs no new kit component and is
 * keyboard- and screen-reader-accessible on its own.
 */
export const Advanced = ({
  children,
  label = "Advanced",
}: {
  children: ReactNode;
  label?: string;
}) => (
  <details className="group rounded-xl border border-border bg-surface">
    <summary className="cursor-pointer list-none px-5.5 py-4.5 font-display text-[1.0625rem] font-bold select-none marker:content-none">
      <span className="mr-2 inline-block transition-transform group-open:rotate-90">{">"}</span>
      {label}
    </summary>
    <div className="flex flex-col gap-4 border-t border-border px-5.5 py-4.5">{children}</div>
  </details>
);
