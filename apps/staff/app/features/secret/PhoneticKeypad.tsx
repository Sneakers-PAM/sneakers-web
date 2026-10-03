import { cn } from "@sneakers-web/ui";

import { phoneticFor } from "@/features/secret/phonetic";

const TONE = {
  digit: "border-transparent bg-sunken",
  lower: "border-border bg-surface",
  symbol: "border-transparent bg-warn-soft",
  upper: "border-transparent bg-primary-soft",
};

/**
 * The value spelled out on a four-column keypad, each key numbered so a long value is easy to
 * read aloud. Capitals, digits and symbols each get their own colour as well as a word.
 */
export const PhoneticKeypad = ({ label, value }: { label: string; value: string }) => (
  <ol aria-label={`${label}, spelled out`} className="m-0 grid list-none grid-cols-4 gap-2 p-0">
    {[...value].map((ch, index) => {
      const { kind, word } = phoneticFor(ch);
      return (
        <li
          className={cn(
            "relative flex min-h-19 flex-col items-center justify-center gap-1 rounded-lg border-[1.5px] px-2 pt-4 pb-2",
            TONE[kind],
          )}
          key={index}
        >
          <span className="absolute top-1.5 left-2 font-mono text-[0.6875rem] text-muted">
            {index + 1}
          </span>
          <span className="font-mono text-[1.625rem] leading-none font-bold">
            {ch === " " ? "␣" : ch}
          </span>
          <span className="text-small text-muted">{word}</span>
        </li>
      );
    })}
  </ol>
);
