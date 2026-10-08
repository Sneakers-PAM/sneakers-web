import type { ValidationCheck } from "@/lib/osadmin/types";

const LABELS: Record<string, string> = {
  chain: "Chain",
  key: "Key",
  names: "Names",
  usage: "Usage",
  validity: "Validity",
};

/** Every check a certificate went through, each with its one-sentence result. */
export const ValidationList = ({
  checks,
  passed,
}: {
  checks: ValidationCheck[];
  passed: boolean;
}) => (
  <section aria-label="Validation" className="flex flex-col gap-2">
    <p className="font-bold">{passed ? "Validation passed" : "Validation failed"}</p>
    <ul className="flex flex-col gap-1.5 text-small">
      {checks.map((check, index) => (
        <li className="flex gap-2" key={`${check.name}-${String(index)}`}>
          <span aria-hidden className={check.passed ? "text-ok" : "text-danger"}>
            {check.passed ? "v" : "x"}
          </span>
          <span className="w-20 shrink-0 font-bold">{LABELS[check.name] ?? check.name}</span>
          <span>
            <span className="sr-only">{check.passed ? "passed: " : "failed: "}</span>
            {check.detail}
          </span>
        </li>
      ))}
    </ul>
  </section>
);
