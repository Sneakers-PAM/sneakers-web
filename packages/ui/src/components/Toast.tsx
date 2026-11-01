import { useEffect, useState } from "react";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";

import { toastProblemAction } from "#ui/components/ProblemAction";

/** The Display button's top edge is 3.5rem up at most, so this clears it at any width. */
const CLEAR_OF_DISPLAY = { bottom: "4rem" };

/**
 * The toast stack: dark ink toasts, above dialogs, bottom center unless told otherwise. The
 * stack sits just above the Display button in the bottom right corner, because at phone width a
 * toast spans the screen and would otherwise run under it.
 */
export const Toaster = ({
  position = "bottom-center",
}: {
  position?: React.ComponentProps<typeof Sonner>["position"];
}) => {
  return (
    <Sonner
      gap={10}
      mobileOffset={CLEAR_OF_DISPLAY}
      offset={CLEAR_OF_DISPLAY}
      position={position}
      style={{ "--width": "22rem", zIndex: "var(--z-toast)" } as React.CSSProperties}
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
    /** An error toast. It offers the problem action (Copy diagnostics) unless it has its own. */
    error: (message: string, options?: Parameters<typeof sonnerToast.error>[1]) => {
      announce(message);
      const problem = toastProblemAction();
      const withAction =
        problem && !options?.action
          ? {
              ...options,
              action: { label: problem.label, onClick: () => void problem.run(message) },
            }
          : options;
      return sonnerToast.error(message, withAction);
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
