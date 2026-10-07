import { Button, toast } from "@sneakers-web/ui";
import { Copy } from "lucide-react";

import { databaseConnectionExamples } from "@/features/secret/connectionExamples";
import { Panel } from "@/features/secret/Panel";

const Example = ({ label, text }: { label: string; text: string }) => (
  <div className="flex items-start gap-2 border-b border-border px-6 py-4 last:border-b-0">
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="font-mono text-label font-bold tracking-[0.06em] text-muted uppercase">
        {label}
      </span>
      <pre className="m-0 overflow-x-auto rounded-sm bg-sunken px-2.5 py-2 font-mono text-[0.8125rem] text-ink">
        <code>{text}</code>
      </pre>
    </div>
    <Button
      aria-label={`Copy ${label}`}
      className="mt-6 shrink-0"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        toast(`${label} copied.`);
      }}
      size="xs"
      variant="secondary"
    >
      <Copy aria-hidden />
      Copy
    </Button>
  </div>
);

/** D-08: how to connect to a database secret, built from its own fields. Never the password. */
export const DatabaseConnectionCard = ({ fields }: { fields: Record<string, string> }) => {
  const examples = databaseConnectionExamples(fields);
  if (examples.length === 0) return null;
  return (
    <Panel subtitle="Built from this secret's own fields." title="Connect">
      {examples.map((example) => (
        <Example key={example.label} label={example.label} text={example.text} />
      ))}
    </Panel>
  );
};
