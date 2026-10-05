import { createContext, type ReactNode, useContext } from "react";

/**
 * An action every problem treatment offers (the shell's Copy diagnostics). `run` gets the
 * message the treatment showed, so the action can find what was behind it.
 */
export interface ProblemAction {
  label: string;
  run: (message?: string) => unknown;
}

const Context = createContext<null | ProblemAction>(null);

/** Danger and warning alerts under this provider offer the action. */
export const ProblemActionProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: null | ProblemAction;
}) => <Context.Provider value={value}>{children}</Context.Provider>;

export const useProblemAction = (): null | ProblemAction => useContext(Context);

let toastAction: null | ProblemAction = null;

/** Error toasts offer this action. Toasts render outside the React tree, so it's set once. */
export const setToastProblemAction = (action: null | ProblemAction): void => {
  toastAction = action;
};

export const toastProblemAction = (): null | ProblemAction => toastAction;
