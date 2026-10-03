import type { ReactNode } from "react";

import { EdgeBanner } from "@sneakers-web/shell";
import { Wordmark } from "@sneakers-web/ui";

/**
 * The full-screen card the terminal shows instead of a session (U-12, 14s): why there's no
 * terminal, and where to go instead.
 */
export const NoSession = ({
  actions,
  body,
  title,
}: {
  actions: ReactNode;
  body: ReactNode;
  title: ReactNode;
}) => (
  <div className="flex min-h-dvh flex-col bg-bg text-ink">
    <EdgeBanner />
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <Wordmark className="text-[1.5rem]" />
      <section className="flex w-full max-w-[480px] flex-col gap-4.5 rounded-[24px] border border-border bg-surface p-6 shadow-menu tablet:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="m-0 font-display text-[1.5rem] leading-[1.15] font-bold">{title}</h1>
          <p className="m-0 text-body leading-[1.5] text-muted">{body}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">{actions}</div>
      </section>
    </main>
  </div>
);
