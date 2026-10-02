import { X } from "lucide-react";
import { Label as LabelPrimitive } from "radix-ui";
import { cloneElement, isValidElement, type ReactElement, type ReactNode, useId } from "react";

import { cn } from "#ui/lib/cn";

export interface FieldProps {
  /** A single control. It gets the id, aria-invalid and aria-describedby wired in. */
  children: ReactElement<Record<string, unknown>>;
  className?: string;
  error?: ReactNode;
  hint?: ReactNode;
  label: ReactNode;
  /** Shown to the right of the label, such as a "Forgot password?" link. */
  labelAside?: ReactNode;
  required?: boolean;
}

/** A label, one control, and its hint or error, wired together for screen readers. */
export const Field = ({
  children,
  className,
  error,
  hint,
  label,
  labelAside,
  required,
}: FieldProps) => {
  const id = useId();
  const controlId = (children.props.id as string | undefined) ?? `${id}-control`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null]
    .filter(Boolean)
    .join(" ");
  const control = isValidElement(children)
    ? cloneElement(children, {
        "aria-describedby": describedBy || undefined,
        "aria-invalid": error ? true : undefined,
        "aria-required": required || undefined,
        id: controlId,
      })
    : children;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline gap-2">
        <Label htmlFor={controlId}>
          {label}
          {required && (
            <span aria-hidden className="text-danger">
              {" "}
              *
            </span>
          )}
        </Label>
        {labelAside && <span className="ml-auto text-[0.875rem] font-bold">{labelAside}</span>}
      </div>
      {control}
      {hint && !error && (
        <span className="text-small text-muted" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span
          className="flex items-start gap-1 text-small font-bold text-danger"
          id={`${id}-error`}
          role="alert"
        >
          <X aria-hidden className="mt-px size-3.5 shrink-0" strokeWidth={3} />
          {error}
        </span>
      )}
    </div>
  );
};

export const Label = ({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) => {
  return (
    <LabelPrimitive.Root
      className={cn("text-[0.875rem] leading-none font-bold text-ink", className)}
      {...props}
    />
  );
};
