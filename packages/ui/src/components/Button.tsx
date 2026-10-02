import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

import { Spinner } from "#ui/components/Spinner";
import { cn } from "#ui/lib/cn";

export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold transition-colors duration-[120ms] ease-laces disabled:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    defaultVariants: { size: "md", variant: "primary" },
    variants: {
      block: { true: "w-full" },
      size: {
        icon: "size-10 p-0",
        "icon-sm": "size-8 p-0",
        lg: "h-13 px-5 text-body-lg",
        md: "h-11 px-4 text-body",
        sm: "h-9 px-3.5 text-[0.875rem]",
        xs: "h-8 px-2.5 text-small",
      },
      variant: {
        caution:
          "border-[1.5px] border-warn bg-warn-soft text-warn hover:bg-warn hover:text-surface disabled:border-border-strong disabled:bg-sunken disabled:text-muted",
        danger:
          "bg-danger text-on-danger hover:bg-danger-hover active:translate-y-px disabled:bg-sunken disabled:text-muted",
        ghost:
          "bg-transparent text-primary hover:bg-primary-soft active:bg-primary-soft disabled:text-muted",
        ink: "bg-ink text-bg hover:opacity-90 disabled:bg-sunken disabled:text-muted",
        link: "h-auto bg-transparent px-0 text-primary hover:text-ink disabled:text-muted",
        primary:
          "bg-primary text-on-primary hover:bg-primary-hover active:translate-y-px active:bg-primary-active disabled:bg-sunken disabled:text-muted",
        secondary:
          "border-[1.5px] border-border-strong bg-surface text-ink hover:border-control hover:bg-sunken active:bg-neutral-soft disabled:border-dashed disabled:text-muted",
      },
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  /** Render the child element (a link, say) with the button's styling instead of a button. */
  asChild?: boolean;
  /** Shows a spinner and the given label, and disables the button. */
  loading?: boolean;
  loadingLabel?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    asChild,
    block,
    children,
    className,
    disabled,
    loading,
    loadingLabel,
    size,
    type,
    variant,
    ...props
  },
  ref,
) {
  const classes = cn(
    buttonVariants({ block, size, variant }),
    loading && "pointer-events-none opacity-75",
    className,
  );
  if (asChild) {
    return (
      <Slot.Root className={classes} ref={ref} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      aria-busy={loading || undefined}
      aria-disabled={loading || undefined}
      className={classes}
      disabled={disabled}
      ref={ref}
      type={type ?? "button"}
      {...props}
      onClick={
        loading
          ? (event) => {
              // A busy button swallows clicks, so a slow submit can't be sent twice.
              event.preventDefault();
            }
          : props.onClick
      }
    >
      {loading ? (
        <>
          <Spinner className="size-4" />
          {loadingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
});
