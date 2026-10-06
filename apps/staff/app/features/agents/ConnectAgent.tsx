import { Button, Card, Tabs, TabsContent, TabsList, TabsTrigger, toast } from "@sneakers-web/ui";
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

type ClientId = "claude-code" | "claude-desktop" | "generic" | "vscode";

const CLIENTS: { id: ClientId; label: string }[] = [
  { id: "claude-code", label: "Claude's CLI" },
  { id: "claude-desktop", label: "Claude Desktop" },
  { id: "vscode", label: "VS Code" },
  { id: "generic", label: "Generic JSON" },
];

/** The shape most remote-MCP clients use: a named server with an HTTP URL. */
const mcpServersJson = (url: string) =>
  JSON.stringify({ mcpServers: { sneakers: { type: "http", url } } }, null, 2);

/** What to show for a client: the snippet to copy, and where it goes. */
const setupFor = (id: ClientId, url: string): { body: string; note: string } => {
  if (id === "claude-code")
    return {
      body: `claude mcp add --transport http sneakers ${url}`,
      note: "Run this where Claude's CLI is installed.",
    };
  if (id === "claude-desktop")
    return {
      body: mcpServersJson(url),
      note: 'Settings → Developer → Edit Config, under "mcpServers".',
    };
  if (id === "vscode")
    return {
      body: JSON.stringify({ servers: { sneakers: { type: "http", url } } }, null, 2),
      note: "Command Palette → MCP: Add Server, or paste into .vscode/mcp.json.",
    };
  return {
    body: JSON.stringify({ name: "sneakers", transport: "http", url }, null, 2),
    note: "The shape most MCP clients expect; adapt the keys to yours.",
  };
};

const Snippet = ({ label, text }: { label: string; text: string }) => (
  <div className="flex items-start gap-2">
    <pre className="m-0 min-w-0 flex-1 overflow-x-auto rounded-sm bg-sunken px-2.5 py-2 font-mono text-[0.8125rem] text-ink">
      <code>{text}</code>
    </pre>
    <Button
      aria-label={`Copy ${label}`}
      className="shrink-0"
      onClick={() => {
        void navigator.clipboard?.writeText(text);
        toast(`${label} copied`);
      }}
      size="xs"
      variant="secondary"
    >
      <Copy aria-hidden />
      Copy
    </Button>
  </div>
);

/** Setup steps for each MCP client, the server URL already filled in. */
const ClientSetup = ({ mcpUrl }: { mcpUrl: string }) => (
  <Tabs defaultValue="claude-code">
    <TabsList aria-label="MCP client" className="w-full">
      {CLIENTS.map((c) => (
        <TabsTrigger className="flex-1" key={c.id} value={c.id}>
          {c.label}
        </TabsTrigger>
      ))}
    </TabsList>
    {CLIENTS.map((c) => {
      const { body, note } = setupFor(c.id, mcpUrl);
      return (
        <TabsContent className="mt-3 flex flex-col gap-1.5" key={c.id} value={c.id}>
          <Snippet label={`the ${c.label} setup`} text={body} />
          <span className="text-[0.8125rem] text-muted">{note}</span>
        </TabsContent>
      );
    })}
  </Tabs>
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
            <ClientSetup mcpUrl={mcpUrl} />
          ) : (
            "Your administrator has the Sneakers-PAM MCP server address."
          )
        }
        n={1}
        title="Add this server to your MCP client"
      />
      <Step
        body="The agent opens a consent page. Name the token and allow it. You're asked for your second factor only if you signed in more than your step-up window ago."
        n={2}
        title="Allow it in the browser"
      />
      <Step
        body={
          <>
            Secrets you can read just work. For one set to need approval, an owner or approver
            decides in Approvals, or you confirm the task once when nobody else can. See the full{" "}
            <a className="font-bold text-primary" href="#how-approvals-work">
              approvals matrix
            </a>
            .
          </>
        }
        n={3}
        title="Use your secrets"
      />
    </ol>
  </Card>
);
