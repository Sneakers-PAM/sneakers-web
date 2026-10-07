import { cn } from "@sneakers-web/ui";

export const STEP_TITLES = [
  "Enter the setup code",
  "Create the first admin",
  "Add a recovery key",
  "Network (optional)",
  "How your data is protected",
  "Sign in to finish",
] as const;

/** The progress line on every setup page: six numbered steps, the current one marked. */
export const SetupProgress = ({ current }: { current: number }) => (
  <nav aria-label="Setup progress">
    <ol className="m-0 flex list-none items-center gap-1 p-0">
      {STEP_TITLES.map((title, index) => {
        const number = index + 1;
        const done = number < current;
        const here = number === current;
        return (
          <li
            aria-current={here ? "step" : undefined}
            className="flex flex-1 items-center gap-1 last:flex-none"
            key={title}
          >
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-small font-bold",
                done && "border-primary bg-primary text-on-primary",
                here && "border-primary text-primary ring-3 ring-primary-soft",
                !done && !here && "border-border-strong text-muted",
              )}
            >
              {number}
              <span className="sr-only">{`: ${title}${done ? ", done" : ""}`}</span>
            </span>
            {number < STEP_TITLES.length && (
              <span
                aria-hidden
                className={cn("h-0.5 flex-1 rounded-full", done ? "bg-primary" : "bg-border")}
              />
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);
