import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

import { cn } from "#ui/lib/cn";

export const inputClasses =
  "h-11 w-full min-w-0 rounded-md border-[1.5px] border-control bg-surface px-3.5 text-body text-ink placeholder:text-muted outline-none transition-[border-color,box-shadow] duration-[120ms] ease-laces focus:border-primary focus:ring-3 focus:ring-primary-soft disabled:cursor-not-allowed disabled:border-border disabled:bg-sunken disabled:text-muted aria-invalid:border-2 aria-invalid:border-danger aria-invalid:bg-danger-soft";

export type InputProps = {
  /** Set values in the mono face (hostnames, codes, keys). */
  mono?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, mono, type, ...props },
  ref,
) {
  return (
    <input
      className={cn(inputClasses, mono && "font-mono font-medium", className)}
      ref={ref}
      type={type ?? "text"}
      {...props}
    />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  { mono?: boolean } & TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, mono, ...props }, ref) {
  return (
    <textarea
      className={cn(
        inputClasses,
        "h-auto min-h-24 py-2.5 leading-[1.45]",
        mono && "font-mono text-code",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
