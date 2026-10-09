import { Brand, cn, EnvironmentTag, Mark } from "@sneakers-web/ui";
import { type ReactNode } from "react";

import { versionLabel } from "#shell/gate/versionLabel";
import { EdgeBanner } from "#shell/layout/EdgeBanner";
import { useRootData } from "#shell/root/useRootData";

/**
 * The frame for screens shown before the app opens (connecting, offline, not set up,
 * enrolment, password reset, crash): the brand above one centred card.
 */
export const CenteredFrame = ({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) => {
  return (
    <div className="flex min-h-dvh flex-col bg-sunken">
      <EdgeBanner />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12 tablet:px-12">
        <Brand hole="var(--color-sunken)" wordmarkClassName="text-[1.375rem]" />
        <div
          className={cn(
            "flex w-full max-w-120 flex-col gap-4.5 rounded-2xl border border-border bg-surface p-6 shadow-menu tablet:p-8",
            className,
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
};

/** The DEV or QA badge for this install; production shows none. */
export const EnvironmentBadge = ({ className }: { className?: string }) => {
  const env = useRootData().config.appEnv;
  if (env === "prod") return null;
  return <EnvironmentTag className={className} env={env} />;
};

export const FrameTitle = ({ body, title }: { body?: ReactNode; title: ReactNode }) => {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="m-0 font-display text-[1.5rem] leading-[1.15] font-bold">{title}</h1>
      {body && <p className="m-0 text-body leading-[1.5] text-muted">{body}</p>}
    </div>
  );
};

/**
 * The split sign-in layout: the brand panel with the still logo on the left, the form
 * on the right. On a phone the brand panel shrinks to a header.
 */
export const SignInLayout = ({ children }: { children: ReactNode }) => {
  const { version } = useRootData().config;
  return (
    <div className="flex min-h-dvh flex-col">
      <EdgeBanner />
      <div className="grid flex-1 desktop:grid-cols-[minmax(0,1fr)_35rem]">
        <aside className="flex flex-col justify-between gap-8 overflow-hidden bg-sunken px-6 py-6 tablet:px-16 desktop:py-14">
          <div className="flex items-center gap-3">
            <Brand hole="var(--color-sunken)" size={36} wordmarkClassName="text-[1.5rem]" />
            <EnvironmentBadge />
          </div>
          <div className="hidden max-w-140 flex-col gap-5.5 desktop:flex">
            <div className="-ml-3">
              <Mark hole="var(--color-sunken)" size={300} />
            </div>
            <p className="m-0 font-display text-[3.5rem] leading-none font-extrabold tracking-[-0.03em] text-balance">
              Tie it once.
              <br />
              Tie it properly.
            </p>
            <p className="m-0 max-w-115 text-[1.1875rem] leading-normal text-pretty text-muted">
              The team vault for passwords, keys and privileged accounts. Every reveal is recorded.
            </p>
          </div>
          <span className="hidden font-mono text-small text-muted desktop:block">
            Open source{version ? ` · ${versionLabel(version)}` : ""}
          </span>
        </aside>
        <main className="flex items-start justify-center bg-bg px-6 py-10 tablet:items-center tablet:p-12">
          <div className="flex w-full max-w-105 flex-col gap-5">{children}</div>
        </main>
      </div>
    </div>
  );
};

export const SignInTitle = ({ body, title }: { body?: ReactNode; title: ReactNode }) => {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="m-0 font-display text-[2rem] leading-[1.1] font-bold tracking-[-0.02em]">
        {title}
      </h1>
      {body && <p className="m-0 text-[1rem] leading-[1.45] text-muted">{body}</p>}
    </div>
  );
};
