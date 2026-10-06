import type { LoaderFunctionArgs } from "react-router";

import { AdminBreakGlassSessionsDocument } from "@sneakers-web/api-client";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  cn,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Label,
  PageHeader,
  Pill,
  Segmented,
  Sheet,
  SheetContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  timeAgo,
} from "@sneakers-web/ui";
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  Circle,
  Cog,
  Diamond,
  Download,
  TriangleAlert,
} from "lucide-react";
import { useRef } from "react";
import {
  Form,
  Link,
  useHref,
  useLoaderData,
  useNavigation,
  useRevalidator,
  useSearchParams,
  useSubmit,
} from "react-router";

import { BreakGlassSessions } from "@/components/BreakGlassSessions";
import { PageError } from "@/components/PageError";
import { adminLoad } from "@/lib/admin.server";
import { type AuditFilters, filtersFrom, readAudit } from "@/lib/audit.server";
import { actionLabel, actionTone } from "@/lib/auditActions";

export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const filters = filtersFrom(new URL(request.url));
    const [d, breakGlass] = await Promise.all([
      readAudit(gw, filters),
      // Best effort: an older gateway, or a blip, leaves the sessions card out.
      gw
        .gql(AdminBreakGlassSessionsDocument, { limit: 20 })
        .then((r) => r.breakGlassSessions)
        .catch(() => []),
    ]);
    return { ...d, breakGlass, checkedAt: Date.now(), filters };
  });

export const meta = () => [{ title: "Audit trail · Sneakers-PAM admin console" }];

type AuditRow = Awaited<ReturnType<typeof loader>>["records"][number];

const pad = (n: number) => String(n).padStart(2, "0");

/** "Today 14:02:11", "Yesterday 09:30:00", or "12 Sept 14:02:11", in the reader's time zone. */
const when = (iso: string) => {
  const d = new Date(iso);
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  const day = new Date(d).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  if (day === today) return `Today ${time}`;
  if (today - day === 86_400_000) return `Yesterday ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${time}`;
};

const TierBadge = ({ tier }: { tier: string }) =>
  tier === "audit" ? (
    <Badge icon={<Diamond aria-hidden fill="currentColor" />} tone="primary">
      audit
    </Badge>
  ) : (
    <Badge className="border-dashed" icon={<Circle aria-hidden />} tone="neutral">
      activity
    </Badge>
  );

const SensitivePill = () => (
  <Pill icon={<Circle aria-hidden fill="currentColor" />} tone="danger">
    sensitive
  </Pill>
);

const ActionName = ({ action }: { action: string }) => {
  const tone = actionTone(action);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-bold",
        tone === "danger" && "text-danger",
        tone === "warn" && "text-warn",
      )}
    >
      {tone !== "plain" && <TriangleAlert aria-hidden className="size-3.5" />}
      {actionLabel(action)}
    </span>
  );
};

const Actor = ({ row, userIds }: { row: AuditRow; userIds: Set<string> }) => {
  const name = <span className="font-bold">{row.actorName}</span>;
  // The system actor and a service account have no /users/:id record to link to.
  const linkable = userIds.has(row.actorUserId);
  return (
    <span className="flex items-center gap-2.5">
      {linkable ? (
        <Avatar name={row.actorName} size={28} tone="primary" />
      ) : (
        <span
          aria-hidden
          className="inline-flex size-7 items-center justify-center rounded-[9px] bg-sunken"
        >
          <Cog className="size-3.5" />
        </span>
      )}
      {linkable ? (
        <Link className="text-inherit" to={`/users/${row.actorUserId}`}>
          {name}
        </Link>
      ) : (
        name
      )}
    </span>
  );
};

/** secret.update keeps its field changes as JSON: plain fields with old and new, sensitive ones by name only. */
const changesOf = (row: AuditRow) => {
  const read = (key: string): unknown => {
    try {
      return JSON.parse(row.attributes.find((a) => a.key === key)?.value ?? "null");
    } catch {
      return null;
    }
  };
  const plain = read("changes");
  const sensitive = read("sensitiveChanged");
  return {
    plain: Array.isArray(plain)
      ? (plain as { field: string; new?: string; old?: string }[]).filter(
          (c) => typeof c?.field === "string",
        )
      : [],
    sensitive: Array.isArray(sensitive)
      ? sensitive.filter((f): f is string => typeof f === "string")
      : [],
  };
};

const RecordSheet = ({
  broken,
  groups,
  onClose,
  row,
}: {
  broken: boolean;
  groups: { id: string; name: string }[];
  onClose: () => void;
  row: AuditRow;
}) => {
  const changes = row.action === "secret.update" ? changesOf(row) : { plain: [], sensitive: [] };
  const attributes = row.attributes.filter(
    (a) =>
      !(row.action === "secret.update" && (a.key === "changes" || a.key === "sensitiveChanged")),
  );
  const facts: [string, React.ReactNode][] = [
    ["Actor", row.actorName],
    ["Subject", row.subject || "—"],
    ...(row.groupId
      ? ([["Group", groups.find((g) => g.id === row.groupId)?.name ?? row.groupId]] as [
          string,
          string,
        ][])
      : []),
    [
      "Time",
      <span className="font-mono" key="t">
        {row.occurredAt
          .replace("T", " ")
          .replace(/\.\d+Z$/, "Z")
          .replace("Z", " UTC")}
      </span>,
    ],
    [
      "Seq",
      <span className="font-mono" key="s">
        #{row.seq}
      </span>,
    ],
    ["Tier", `${row.tier}${row.sensitive ? " · sensitive value" : ""}`],
  ];
  return (
    <Sheet onOpenChange={(open) => !open && onClose()} open>
      <SheetContent title={`Record #${row.seq}: ${actionLabel(row.action)}`}>
        <div className="flex flex-col gap-5 overflow-y-auto px-5.5 py-5">
          <ActionName action={row.action} />
          {broken && (
            <Alert tone="danger">
              <b>This record&apos;s hash doesn&apos;t match.</b> It was changed or removed after it
              was written. Records after it can&apos;t be trusted until this is explained.
            </Alert>
          )}
          <dl className="m-0 overflow-hidden rounded-lg border border-border">
            {facts.map(([k, v]) => (
              <div
                className="grid grid-cols-[7rem_1fr] border-t border-border first:border-t-0"
                key={k}
              >
                <dt className="bg-sunken px-3.5 py-2.5 text-small font-bold">{k}</dt>
                <dd className="m-0 px-3.5 py-2.5 text-small">{v}</dd>
              </div>
            ))}
          </dl>
          {(changes.plain.length > 0 || changes.sensitive.length > 0) && (
            <div className="flex flex-col gap-2">
              <b className="text-small">Changes</b>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-small">
                {changes.plain.map((c) => (
                  <li className="flex flex-wrap items-center gap-1.5" key={c.field}>
                    <span className="font-mono text-muted">{c.field}</span>
                    <span>{c.old || "—"}</span>
                    <ArrowRight aria-label="to" className="size-3.5 text-muted" />
                    <b>{c.new || "—"}</b>
                  </li>
                ))}
                {changes.sensitive.map((f) => (
                  <li className="flex items-center gap-1.5" key={f}>
                    <span className="font-mono text-muted">{f}</span>
                    <Badge tone="sunken">changed</Badge>
                    <span className="text-muted">value hidden</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {attributes.length > 0 && (
            <div className="flex flex-col gap-2">
              <b className="text-small">Attributes</b>
              <dl className="m-0 overflow-hidden rounded-lg border border-border font-mono text-small">
                {attributes.map((a) => (
                  <div
                    className="grid grid-cols-[9rem_1fr] border-t border-border px-3.5 py-2 first:border-t-0"
                    key={a.key}
                  >
                    <dt className="text-muted">{a.key}</dt>
                    <dd className="m-0 break-words">{a.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <b className="text-small">Hash chain</b>
            <code className="block rounded-lg bg-sunken px-3.5 py-2.5 font-mono text-small break-all">
              <span className="text-muted">prev </span>
              {row.prevHash || "(first record)"}
            </code>
            <ArrowDown aria-hidden className="size-3.5 self-center text-muted" />
            <code
              aria-invalid={broken || undefined}
              className={cn(
                "block rounded-lg bg-sunken px-3.5 py-2.5 font-mono text-small break-all",
                broken && "border-2 border-danger bg-danger-soft",
              )}
            >
              <span className="text-muted">hash </span>
              {row.hash}
            </code>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

const WHEN_OPTIONS: { label: string; value: AuditFilters["when"] }[] = [
  { label: "All", value: "all" },
  { label: "24 h", value: "24h" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "Custom", value: "custom" },
];

const SHOW_OPTIONS: { label: string; value: AuditFilters["show"] }[] = [
  { label: "25", value: "25" },
  { label: "50", value: "50" },
  { label: "100", value: "100" },
  { label: "All", value: "all" },
];

const Audit = () => {
  const { actions, breakGlass, capped, chain, checkedAt, filters, groups, records, userIds } =
    useLoaderData<typeof loader>();
  const linkableUserIds = new Set(userIds);
  const [parameters] = useSearchParams();
  const submit = useSubmit();
  const form = useRef<HTMLFormElement>(null);
  const revalidator = useRevalidator();
  const busy = useNavigation().state !== "idle" || revalidator.state !== "idle";
  const selected = records.find((r) => String(r.seq) === parameters.get("seq"));
  /** Re-run the search with the form's fields, changed by `patch`; the open record closes. */
  const send = (patch: Record<string, string | string[]>) => {
    const next = new URLSearchParams();
    if (form.current) {
      for (const [k, v] of new FormData(form.current))
        if (typeof v === "string" && v) next.append(k, v);
    }
    for (const [k, v] of Object.entries(patch)) {
      next.delete(k);
      for (const item of [v].flat()) next.append(k, item);
    }
    void submit(next, { preventScrollReset: true, replace: true });
  };
  const withSeq = (seq: null | number) => {
    const next = new URLSearchParams(parameters);
    if (seq === null) next.delete("seq");
    else next.set("seq", String(seq));
    return `?${next.toString()}`;
  };
  // A plain link, so the browser downloads the file; useHref adds the app's base (/admin).
  const exportBase = useHref("/audit/export");
  const exportQuery = (format: string) => {
    const next = new URLSearchParams(parameters);
    next.delete("seq");
    next.set("format", format);
    return `${exportBase}?${next.toString()}`;
  };
  const hidden = new Set(filters.hide);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary">
                <Download aria-hidden />
                Export
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <a download href={exportQuery("csv")} rel="noopener" target="_self">
                  CSV (spreadsheets)
                </a>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a download href={exportQuery("jsonl")} rel="noopener" target="_self">
                  JSON lines, with hashes
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        eyebrow="Governance · Audit"
        title="Audit trail"
      />

      {chain.valid ? (
        <Alert
          action={
            <Button
              loading={busy}
              loadingLabel="Checking…"
              onClick={() => void revalidator.revalidate()}
              variant="ink"
            >
              Verify again
            </Button>
          }
          title={`Chain verified · ${chain.length.toLocaleString("en-GB")} records`}
          tone="ok"
        >
          Every record links to the one before it. Checked {timeAgo(checkedAt)}.
        </Alert>
      ) : (
        <Alert
          action={
            <Button asChild variant="secondary">
              <Link to={withSeq(chain.brokenAtSeq)}>Open #{chain.brokenAtSeq}</Link>
            </Button>
          }
          role="alert"
          title={`Chain broken at #${chain.brokenAtSeq}`}
          tone="danger"
        >
          Record #{chain.brokenAtSeq} doesn&apos;t match the chain. Something changed it after it
          was written. Records after it can&apos;t be trusted until this is explained.
        </Alert>
      )}

      <BreakGlassSessions sessions={breakGlass} />

      <Card className="p-4.5">
        <Form className="flex flex-wrap items-end gap-4" method="get" ref={form} role="search">
          <div className="flex w-48 flex-col gap-2">
            <Label htmlFor="audit-actor">Actor</Label>
            <Input
              defaultValue={filters.actor}
              id="audit-actor"
              name="actor"
              onBlur={() => send({})}
              onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), send({}))}
              placeholder="Name or ID"
            />
          </div>
          <div className="flex w-52 flex-col gap-2">
            <Label htmlFor="audit-subject">Subject or resource</Label>
            <Input
              defaultValue={filters.subject}
              id="audit-subject"
              name="subject"
              onBlur={() => send({})}
              onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), send({}))}
              placeholder="e.g. DB admin"
            />
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[0.875rem] font-bold" id="audit-hide">
              Hide actions
            </span>
            {filters.hide.map((h) => (
              <input key={h} name="hide" type="hidden" value={h} />
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  aria-describedby="audit-hide"
                  className="w-48 justify-between"
                  variant="secondary"
                >
                  {hidden.size === 0 ? "None hidden" : `${hidden.size} hidden`}
                  <ChevronDown aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
                {actions.map((a) => (
                  <DropdownMenuCheckboxItem
                    checked={hidden.has(a)}
                    key={a}
                    onCheckedChange={(on) =>
                      send({
                        hide: on ? [...filters.hide, a] : filters.hide.filter((h) => h !== a),
                      })
                    }
                    onSelect={(event) => event.preventDefault()}
                  >
                    {actionLabel(a)}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[0.875rem] font-bold">When</span>
            <input name="when" type="hidden" value={filters.when} />
            <Segmented
              className="w-max [&>button]:whitespace-nowrap"
              label="When"
              onChange={(v) => send({ when: v })}
              options={WHEN_OPTIONS}
              size="sm"
              value={filters.when}
            />
          </div>
          {filters.when === "custom" && (
            <>
              <div className="flex flex-col gap-2">
                <Label htmlFor="audit-from">From</Label>
                <Input
                  defaultValue={filters.from}
                  id="audit-from"
                  name="from"
                  onChange={() => send({})}
                  type="date"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="audit-to">To</Label>
                <Input
                  defaultValue={filters.to}
                  id="audit-to"
                  name="to"
                  onChange={() => send({})}
                  type="date"
                />
              </div>
            </>
          )}
          <div className="flex flex-col gap-2">
            <span className="text-[0.875rem] font-bold">Show</span>
            <input name="show" type="hidden" value={filters.show} />
            <Segmented
              className="w-max [&>button]:whitespace-nowrap"
              label="Show"
              onChange={(v) => send({ show: v })}
              options={SHOW_OPTIONS}
              size="sm"
              value={filters.show}
            />
          </div>
        </Form>
      </Card>

      {records.length === 0 ? (
        <EmptyState
          body="Nothing matches these filters. Widen the time range or clear a filter."
          loader={false}
          title="No records"
        />
      ) : (
        <Card>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Seq</TableHeaderCell>
                <TableHeaderCell>Time</TableHeaderCell>
                <TableHeaderCell>Actor</TableHeaderCell>
                <TableHeaderCell>Action</TableHeaderCell>
                <TableHeaderCell>Subject</TableHeaderCell>
                <TableHeaderCell>Tier</TableHeaderCell>
                <TableHeaderCell>
                  <span className="sr-only">Sensitive</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {records.map((r) => {
                const bad = !chain.valid && r.seq === chain.brokenAtSeq;
                return (
                  <TableRow
                    className={cn(
                      bad &&
                        "bg-danger-soft shadow-[inset_3px_0_0_var(--color-danger)] hover:bg-danger-soft",
                    )}
                    key={r.seq}
                    selected={selected?.seq === r.seq}
                  >
                    <TableCell
                      className={cn("font-mono text-small", bad && "font-bold text-danger")}
                    >
                      <Link
                        aria-label={`Open record ${r.seq}`}
                        className="text-inherit"
                        preventScrollReset
                        to={withSeq(r.seq)}
                      >
                        #{r.seq}
                      </Link>
                    </TableCell>
                    <TableCell className="font-mono text-small whitespace-nowrap">
                      {when(r.occurredAt)}
                    </TableCell>
                    <TableCell>
                      <Actor row={r} userIds={linkableUserIds} />
                    </TableCell>
                    <TableCell>
                      <ActionName action={r.action} />
                    </TableCell>
                    <TableCell>{r.subject}</TableCell>
                    <TableCell>
                      <TierBadge tier={r.tier} />
                    </TableCell>
                    <TableCell>{r.sensitive && <SensitivePill />}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center gap-4 border-t border-border px-4.5 py-3 text-small text-muted">
            <span>
              Showing {records.length.toLocaleString("en-GB")} of{" "}
              {chain.length.toLocaleString("en-GB")} records
              {capped && " (a date range looks at the newest 2,000)"}
            </span>
            <span className="ml-auto flex items-center gap-2">
              <TierBadge tier="audit" /> security-relevant
            </span>
            <span className="flex items-center gap-2">
              <TierBadge tier="activity" /> routine
            </span>
          </div>
        </Card>
      )}

      {selected && (
        <RecordSheet
          broken={!chain.valid && selected.seq === chain.brokenAtSeq}
          groups={groups}
          onClose={() =>
            void submit(new URLSearchParams(withSeq(null).slice(1)), {
              preventScrollReset: true,
              replace: true,
            })
          }
          row={selected}
        />
      )}
    </div>
  );
};

export default Audit;

export const ErrorBoundary = () => <PageError />;
