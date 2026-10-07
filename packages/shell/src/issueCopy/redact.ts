import { scrub } from "#shell/diagnostics/report";

// Host names: labels plus a TLD that names a network. Code such as a.b or main.js never ends
// in one of these, so it isn't mistaken for a host.
const TLDS =
  "com|net|org|io|dev|app|cloud|co|ai|edu|gov|mil|info|biz|us|uk|ca|de|eu|fr|nl|au|jp|nyc" +
  "|example|test|invalid|local|localdomain|localhost|lan|corp|internal|intranet|home|priv|private|int";

const PATTERNS: [RegExp, string][] = [
  [/-----BEGIN [^-\n]*-----[\s\S]*?(?:-----END [^-\n]*-----|$)/g, "[pem]"],
  [/\b([a-z][a-z\d+.-]*:\/\/)[^\s/@]+@[^\s/:?#]+/gi, "$1[host]"],
  [/(?<=[\w/.?=&%-])#[^\s"'<>]*/g, ""],
  [/\b[\w.%+-]+@(?:[a-z\d-]+\.)+[a-z]{2,}\b/gi, "[email]"],
  [/\b(?:AKIA|ASIA)[\dA-Z]{16}\b/g, "[redacted]"],
  [/\b([A-Za-z_][\w.-]*)=[^\s&;,"']{8,}/g, "$1=[redacted]"],
  [/(?<![\w/])(?=[\w+=-]*\d)(?=[\w+=-]*[A-Za-z])[\w+=-]{24,}/g, "[redacted]"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]"],
  [/(?<![\w:])(?:[\da-f]{1,4}:){3,7}[\da-f]{1,4}(?![\w:])/gi, "[ip]"],
  [
    /(?<![\w:])(?:[\da-f]{1,4}(?::[\da-f]{1,4})*)?::(?:[\da-f]{1,4}(?::[\da-f]{1,4})*)?(?![\w:])/gi,
    "[ip]",
  ],
  [new RegExp(String.raw`\b(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+(?:${TLDS})\b`, "gi"), "[host]"],
];

/**
 * The one redaction every UI issue error message goes through, before it is cut to length:
 * the logger's credential patterns plus PEM blocks, URL userinfo and fragments, emails,
 * long base64 or hex runs, access key ids, IP addresses and host names.
 */
export const redactIssueText = (s: string): string => {
  let out = s;
  for (const [re, by] of PATTERNS) out = out.replace(re, by);
  return scrub(out);
};
