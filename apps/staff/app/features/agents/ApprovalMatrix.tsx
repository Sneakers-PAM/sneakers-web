import {
  Card,
  Pill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { type ReactNode } from "react";

type Outcome = "approval" | "denied" | "glass" | "works";

const TONE = {
  approval: "warn",
  denied: "danger",
  glass: "danger",
  works: "ok",
} as const;

const LABEL: Record<Outcome, string> = {
  approval: "Needs approval",
  denied: "Refused",
  glass: "Break-the-glass",
  works: "Just works",
};

const Cell = ({ children, outcome }: { children?: ReactNode; outcome: Outcome }) => (
  <TableCell className="align-top">
    <span className="flex flex-col items-start gap-1.5">
      <Pill tone={TONE[outcome]}>{LABEL[outcome]}</Pill>
      {children && <span className="text-[0.875rem] leading-[1.4] text-muted">{children}</span>}
    </span>
  </TableCell>
);

const RowHead = ({ children }: { children: ReactNode }) => (
  <TableHeaderCell
    className="align-top font-sans text-[0.875rem] tracking-normal text-ink normal-case"
    scope="row"
  >
    {children}
  </TableHeaderCell>
);

const Section = ({ children, title }: { children: ReactNode; title: string }) => (
  <section aria-label={title} className="flex flex-col gap-2">
    <h3 className="m-0 text-[1rem] font-bold">{title}</h3>
    {children}
  </section>
);

const Rows = ({ rows }: { rows: [string, string][] }) => (
  <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-[0.875rem] leading-[1.45]">
    {rows.map(([lead, body]) => (
      <li key={lead}>
        <b>{lead}</b> {body}
      </li>
    ))}
  </ul>
);

/**
 * How approvals work: who approves a reveal at each approval level, what happens when nobody
 * else can approve, what never needs one, when a second factor is asked, and one prompt per
 * task. It follows the vault's rules; the same matrix is in the docs.
 */
export const ApprovalMatrix = () => (
  <Card className="flex flex-col gap-5 p-5.5">
    <div className="flex flex-col gap-1">
      <h2
        className="m-0 font-display text-[1.25rem] leading-[1.2] font-bold"
        id="how-approvals-work"
      >
        How approvals work
      </h2>
      <span className="text-[0.875rem] text-muted">
        The same rules for you in the web app and for your agent. Nobody ever approves their own
        request.
      </span>
    </div>
    <Table aria-labelledby="how-approvals-work">
      <caption className="sr-only">
        Who approves a reveal, by who you are and the secret&apos;s approval level
      </caption>
      <TableHead>
        <tr>
          <TableHeaderCell>You are…</TableHeaderCell>
          <TableHeaderCell>Normal secret</TableHeaderCell>
          <TableHeaderCell>Approval-required secret</TableHeaderCell>
          <TableHeaderCell>Always-approve secret</TableHeaderCell>
        </tr>
      </TableHead>
      <TableBody>
        <TableRow>
          <RowHead>An owner (one of possibly several)</RowHead>
          <Cell outcome="works" />
          <Cell outcome="works">Owners are exempt.</Cell>
          <Cell outcome="approval">
            Another owner or a designated approver approves. Never you.
          </Cell>
        </TableRow>
        <TableRow>
          <RowHead>Not an owner, but you can read it</RowHead>
          <Cell outcome="works" />
          <Cell outcome="approval">Any one owner of the secret approves.</Cell>
          <Cell outcome="approval">An owner or a designated approver approves.</Cell>
        </TableRow>
        <TableRow>
          <RowHead>No read access</RowHead>
          <Cell outcome="denied">Ask for access.</Cell>
          <Cell outcome="denied">Ask for access.</Cell>
          <Cell outcome="denied">Ask for access.</Cell>
        </TableRow>
        <TableRow>
          <RowHead>An emergency, with no one able to approve in time</RowHead>
          <Cell outcome="glass">Give a reason and confirm with your second factor.</Cell>
          <Cell outcome="glass">Give a reason and confirm with your second factor.</Cell>
          <Cell outcome="glass">Give a reason and confirm with your second factor.</Cell>
        </TableRow>
      </TableBody>
    </Table>
    <Section title="When nobody else can approve">
      <Rows
        rows={[
          [
            "A one-user install:",
            "nothing waits on another person. A secret set to need approval asks you to confirm the task once with your second factor.",
          ],
          [
            "You're the only owner or approver of an always-approve secret:",
            "the same one confirmation for the whole task. It never goes through Approvals.",
          ],
          [
            "Nobody active can approve, with other people in the install:",
            "the request is refused straight away instead of waiting. An admin can give the folder an owner.",
          ],
        ]}
      />
    </Section>
    <Section title="Never needs approval">
      <Rows
        rows={[
          ["Creating or generating", "a secret in a folder you can write to."],
          ["Updating or rotating", "a secret you can write."],
          [
            "Approving someone else's request",
            "as an owner or approver. You're asked for your second factor if your step-up window has run out.",
          ],
        ]}
      />
    </Section>
    <Section title="Second factor">
      <Rows
        rows={[
          [
            "Web app:",
            "a step-up to approve or confirm, and to reveal where an admin turned that on. After one, no more prompts for 30 minutes.",
          ],
          [
            "Agents:",
            "your second factor once, at /login. Nothing more for anything you can read. Break-the-glass isn't available to agents.",
          ],
        ]}
      />
    </Section>
    <Section title="One task, one prompt">
      <p className="m-0 text-[0.875rem] leading-[1.45]">
        A task&apos;s requests share one page and are decided or confirmed together. Once you
        confirm a task, its later requests go through without asking again for an hour.
      </p>
    </Section>
  </Card>
);
