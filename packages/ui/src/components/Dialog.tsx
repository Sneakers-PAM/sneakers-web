import { X } from "lucide-react";
import { AlertDialog as AlertPrimitive, Dialog as DialogPrimitive } from "radix-ui";

import { buttonVariants } from "#ui/components/Button";
import { cn } from "#ui/lib/cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlayClasses = "fixed inset-0 z-(--z-dialog) bg-[rgb(12_14_20/0.45)]";
const panelClasses =
  "fixed top-1/2 left-1/2 z-(--z-dialog) flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[34rem] -translate-x-1/2 -translate-y-1/2 flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-surface p-7 text-ink shadow-dialog outline-none";

export const DialogContent = ({
  children,
  className,
  hideClose,
  ...props
}: { hideClose?: boolean } & React.ComponentProps<typeof DialogPrimitive.Content>) => {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlayClasses} />
      <DialogPrimitive.Content className={cn(panelClasses, className)} {...props}>
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="absolute top-5 right-5 inline-flex size-9 items-center justify-center rounded-sm text-ink hover:bg-sunken"
          >
            <X aria-hidden className="size-4.5" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};

export const DialogDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) => {
  return (
    <DialogPrimitive.Description
      className={cn("m-0 text-body leading-[1.5] text-muted", className)}
      {...props}
    />
  );
};

export const DialogFooter = ({ className, ...props }: React.ComponentProps<"div">) => {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2.5 tablet:flex-row tablet:justify-end", className)}
      {...props}
    />
  );
};

export const DialogHeader = ({ className, ...props }: React.ComponentProps<"div">) => {
  return <div className={cn("flex flex-col gap-2 pr-10", className)} {...props} />;
};

export const DialogTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) => {
  return (
    <DialogPrimitive.Title
      className={cn("m-0 font-display text-[1.5rem] leading-[1.15] font-bold", className)}
      {...props}
    />
  );
};

export const AlertDialog = AlertPrimitive.Root;
export const AlertDialogTrigger = AlertPrimitive.Trigger;

export const AlertDialogAction = ({
  className,
  variant = "danger",
  ...props
}: {
  variant?: "caution" | "danger" | "primary";
} & React.ComponentProps<typeof AlertPrimitive.Action>) => {
  return (
    <AlertPrimitive.Action className={cn(buttonVariants({ variant }), className)} {...props} />
  );
};

export const AlertDialogCancel = ({
  className,
  ...props
}: React.ComponentProps<typeof AlertPrimitive.Cancel>) => {
  return (
    <AlertPrimitive.Cancel
      className={cn(buttonVariants({ variant: "secondary" }), className)}
      {...props}
    />
  );
};

export const AlertDialogContent = ({
  className,
  ...props
}: React.ComponentProps<typeof AlertPrimitive.Content>) => {
  return (
    <AlertPrimitive.Portal>
      <AlertPrimitive.Overlay className={overlayClasses} />
      <AlertPrimitive.Content className={cn(panelClasses, className)} {...props} />
    </AlertPrimitive.Portal>
  );
};

export const AlertDialogDescription = ({
  className,
  ...props
}: React.ComponentProps<typeof AlertPrimitive.Description>) => {
  return (
    <AlertPrimitive.Description
      className={cn("m-0 text-body leading-[1.5] text-muted", className)}
      {...props}
    />
  );
};

export const AlertDialogTitle = ({
  className,
  ...props
}: React.ComponentProps<typeof AlertPrimitive.Title>) => {
  return (
    <AlertPrimitive.Title
      className={cn("m-0 font-display text-[1.5rem] leading-[1.15] font-bold", className)}
      {...props}
    />
  );
};

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/** A panel that slides in from an edge (right on desktop, bottom on phones when side="bottom"). */
export const SheetContent = ({
  children,
  className,
  side = "right",
  title,
  ...props
}: {
  side?: "bottom" | "left" | "right";
  title: React.ReactNode;
} & React.ComponentProps<typeof DialogPrimitive.Content>) => {
  const sideClasses = {
    bottom: "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl border-t",
    left: "top-0 left-0 h-dvh w-full max-w-[18rem] border-r",
    right: "top-0 right-0 h-dvh w-full max-w-[27.5rem] border-l",
  }[side];
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-(--z-sheet) bg-[rgb(12_14_20/0.35)]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed z-(--z-sheet) flex flex-col border-border-strong bg-surface text-ink shadow-dialog outline-none",
          sideClasses,
          className,
        )}
        {...props}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-5.5 py-5">
          <DialogPrimitive.Title className="m-0 font-display text-h2 font-bold">
            {title}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close"
            className="ml-auto inline-flex size-9 items-center justify-center rounded-sm hover:bg-sunken"
          >
            <X aria-hidden className="size-4.5" />
          </DialogPrimitive.Close>
        </div>
        <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
};
