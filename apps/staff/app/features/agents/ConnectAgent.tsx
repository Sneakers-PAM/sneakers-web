import { Button, Card, toast } from "@sneakers-web/ui";
import { Copy } from "lucide-react";
import { type ReactNode } from "react";

const Step = ({ body, n, title }: { body: ReactNode; n: number; title: string }) => (
  <li className="flex gap-3.5">
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft font-mono text-[0.8125rem] font-bold text-primary"
    >
      {n}
    </span>
    <div className="flex min-w-0 flex-col gap-1.5">
      <b className="text-[0.9375rem]">{title}</b>
      <div className="text-[0.875rem] leading-[1.45] text-muted">{body}</div>
    </div>
  </li>
);

/** How a token comes to exist: the app asks for it, never this page. */
export const ConnectAgent = ({ mcpUrl }: { mcpUrl: null | string }) => (
  <Card className="flex flex-col gap-5 p-5.5">
    <div className="flex flex-col gap-1">
      <h2 className="m-0 font-display text-[1.25rem] leading-[1.2] font-bold">Connect an agent</h2>
      <span className="text-[0.875rem] text-muted">Tokens are created from the app, not here.</span>
    </div>
    <ol className="m-0 flex list-none flex-col gap-4 p-0">
      <Step
        body={
          mcpUrl ? (
            <span className="flex flex-wrap items-center gap-2">
              <code className="rounded-sm bg-sunken px-2 py-1 font-mono text-[0.8125rem] text-ink">
                {mcpUrl}
              </code>
              <Button
                aria-label="Copy server address"
                onClick={() => {
                  void navigator.clipboard?.writeText(mcpUrl);
                  toast("Server address copied");
                }}
                size="xs"
                variant="secondary"
              >
                <Copy aria-hidden />
                Copy
              </Button>
            </span>
          ) : (
            "Your administrator has the Sneakers-PAM MCP server address."
          )
        }
        n={1}
        title="Add this server to your MCP client"
      />
      <Step
        body="The agent opens a consent page. Name the token and confirm with your second factor."
        n={2}
        title="Allow it in the browser"
      />
      <Step
        body="Secrets you can read just work. For one set to need approval, an owner or approver decides in Approvals, or you confirm the task once when nobody else can."
        n={3}
        title="Use your secrets"
      />
    </ol>
  </Card>
);
