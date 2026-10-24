import { plural } from "@sneakers-web/ui";

/** The MFA window as the settings page names it: "30 minutes", "Every time" for 0. */
export const mfaWindow = (seconds: number): string => {
  if (seconds <= 0) return "Every time";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [
    hours > 0 && plural(hours, "hour"),
    minutes > 0 && plural(minutes, "minute"),
    rest > 0 && plural(rest, "second"),
  ]
    .filter(Boolean)
    .join(" ");
};
