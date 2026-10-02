import { useEffect, useState } from "react";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";

/** The toast stack: dark ink toasts in the bottom right, above dialogs. */
export const Toaster = () => {
  return (
    <Sonner
      gap={10}
      position="bottom-right"
      style={{ zIndex: "var(--z-toast)" } as React.CSSProperties}
      toastOptions={{
        classNames: {
          actionButton:
            "ml-auto rounded-sm px-2 py-1 font-bold text-bg underline-offset-2 hover:underline",
          description: "font-normal opacity-80",
          error: "bg-danger text-on-danger",
          title: "flex-1",
          toast:
            "flex w-[22rem] items-center gap-3 rounded-lg bg-ink px-4 py-3.5 text-[0.875rem] font-bold text-bg shadow-dialog",
        },
        unstyled: true,
      }}
    />
  );
};

const listeners = new Set<(message: string) => void>();

/** Read a message to screen readers through the polite live region. */
export const announce = (message: string): void => {
  for (const l of listeners) l(message);
};

/** Toast plus a polite announcement, for reveals, copies and other recorded actions. */
export const toast = Object.assign(
  (message: string, options?: Parameters<typeof sonnerToast>[1]) => {
    announce(message);
    return sonnerToast(message, options);
  },
  {
    dismiss: sonnerToast.dismiss,
    error: (message: string, options?: Parameters<typeof sonnerToast.error>[1]) => {
      announce(message);
      return sonnerToast.error(message, options);
    },
  },
);

/** Mount once per app. Messages passed to announce() are read out politely. */
export const LiveRegion = () => {
  const [message, setMessage] = useState("");
  useEffect(() => {
    const l = (m: string) => {
      setMessage("");
      queueMicrotask(() => setMessage(m));
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return (
    <div aria-live="polite" className="sr-only" data-testid="live-region" role="status">
      {message}
    </div>
  );
};
