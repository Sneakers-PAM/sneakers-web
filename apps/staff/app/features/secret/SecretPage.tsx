import {
  needsStepUp,
  refusalMessage,
  StepUpDialog,
  useRootData,
  useStepUp,
} from "@sneakers-web/shell";
import {
  Alert,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PageHeader,
  Pill,
  shortDate,
  toast,
} from "@sneakers-web/ui";
import { Ban, ChevronDown, ChevronLeft, Clock, ShieldCheck, TriangleAlert } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Link, useRouteLoaderData } from "react-router";

import type { SecretPage as Page } from "@/features/secret/secret.server";
import type { loader as frameLoader } from "@/routes/frame";

import { BreakGlassCard, BreakGlassDialog } from "@/features/secret/BreakGlass";
import { CERT_META_KEYS, certExpiry } from "@/features/secret/certificate";
import { CertificateCard } from "@/features/secret/CertificateCard";
import { ExportDialog, ReplaceDialog } from "@/features/secret/CertificateDialogs";
import { CheckoutCard, type LeaseHours } from "@/features/secret/CheckoutCard";
import { DeleteDialog, RotateDialog } from "@/features/secret/ConfirmDialogs";
import { DatabaseConnectionCard } from "@/features/secret/DatabaseConnectionCard";
import { DetailsRows } from "@/features/secret/DetailsCard";
import { FieldsCard } from "@/features/secret/FieldsCard";
import { HistoryCard } from "@/features/secret/HistoryCard";
import { Panel } from "@/features/secret/Panel";
import { RevealRunProvider } from "@/features/secret/revealRun";
import { AgentAccessCard, AutomationCard } from "@/features/secret/SettingsCards";
import { useSecretFetcher } from "@/features/secret/useSecretFetcher";

type DialogName = "break-glass" | "delete" | "export" | "replace" | "rotate" | null;

const CERT_TYPE = "type-ssl-cert";
const DB_TYPE = "type-database-account";
const SSH_TYPE = "type-ssh-key";

/** Shown on a manage control a site admin can see but not use: the vault's own reason. */
const OWNERS_ONLY_HINT = "owners or authors only";

const Banner = ({
  action,
  body,
  icon,
  title,
  tone,
}: {
  action?: ReactNode;
  body: ReactNode;
  icon: ReactNode;
  title: ReactNode;
  tone: "danger" | "retired" | "warn";
}) => (
  <div
    className={
      tone === "retired"
        ? "flex flex-wrap items-center gap-4 rounded-xl border-[1.5px] border-dashed border-border-strong bg-sunken px-5 py-4"
        : tone === "warn"
          ? "flex flex-wrap items-center gap-4 rounded-xl border-[1.5px] border-warn bg-warn-soft px-5 py-4"
          : "flex flex-wrap items-center gap-4 rounded-xl border-2 border-danger bg-danger-soft px-5 py-4"
    }
    role="status"
  >
    <span className="self-start pt-0.5">{icon}</span>
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <b>{title}</b>
      <span>{body}</span>
    </div>
    {action}
  </div>
);

/** U-04: one secret, its fields behind reveals, its details, automation and history. */
export const SecretPage = ({ page }: { page: Page }) => {
  const { access, fields, folderPath, history, isAdmin, secret, type } = page;
  const viewer = useRouteLoaderData<typeof frameLoader>("routes/frame")?.user;
  const { config } = useRootData();
  const act = useSecretFetcher();
  const glass = useSecretFetcher({ quiet: true });
  const leasing = useSecretFetcher({ quiet: true });
  const stepUp = useStepUp();
  const [hours, setHours] = useState<LeaseHours>("2");
  const handledLease = useRef<unknown>(null);
  const checkOut = () => void leasing.submit({ hours, intent: "checkout" }, { method: "post" });
  const checkIn = () => void leasing.submit({ intent: "checkin" }, { method: "post" });
  const leaseResult = leasing.data;
  useEffect(() => {
    if (!leaseResult || handledLease.current === leaseResult || leaseResult.ok) return;
    handledLease.current = leaseResult;
    // The workflow may want a fresh second factor before a check-out.
    if (needsStepUp(leaseResult.refusal)) stepUp.ask(checkOut);
    else toast.error(refusalMessage(leaseResult.refusal));
  });
  const [dialog, setDialog] = useState<DialogName>(null);
  const [glassEnded, setGlassEnded] = useState<unknown>(null);
  // The answer that was there when the break-glass dialog opened; a newer success closes it.
  const [glassSeen, setGlassSeen] = useState<unknown>(null);

  const glassResult =
    glass.data?.ok && glass.data.intent === "break-glass" ? glass.data : undefined;
  const glassFields = glassResult && glassResult !== glassEnded ? glassResult.fields : undefined;
  const openDialog = (name: DialogName) => {
    if (name === "break-glass") setGlassSeen(glass.data);
    setDialog(name);
  };

  // canRead null means the gateway didn't say: never treat that as readable.
  const read = secret.canRead === true && access.read;
  // The vault's own decision (RACI author), never an admin shortcut.
  const manage = access.manage;
  // An admin sees these controls too, disabled, rather than them vanishing as they would for
  // an ordinary reader without manage: showManage decides visibility, manage decides editing.
  const showManage = manage || isAdmin;
  const isCert = secret.typeId === CERT_TYPE;
  const isDatabase = secret.typeId === DB_TYPE;
  const production = config.appEnv === "prod";
  const lease = page.lease;
  const heldByMe = !!lease && lease.userId === page.viewerId;
  const heldByOther = !!lease && !heldByMe;
  const checksOut = !!type?.checkout;
  const lockedReason = secret.retired
    ? "Retired, restore to reveal"
    : read
      ? checksOut && heldByOther
        ? "Checked out by someone else"
        : // A workflow aid, not a control: read access is what lets someone reveal.
          checksOut && !heldByMe
          ? "Check out first, so others know it's in use"
          : undefined
      : "Request access to reveal";
  const path = folderPath.map((f) => f.name).join(" / ");
  const rotating = type?.fields.find((f) => f.rotates)?.label ?? "credential";
  const expiry = isCert
    ? certExpiry(fields.notAfter ?? secret.expiresAt ?? undefined, page.now)
    : null;
  const send = (intent: string) => void act.submit({ intent }, { method: "post" });

  const primary = secret.retired ? (
    showManage && (
      <Button
        disabled={!manage}
        loading={act.state !== "idle"}
        onClick={() => send("restore")}
        title={manage ? undefined : OWNERS_ONLY_HINT}
      >
        Restore
      </Button>
    )
  ) : read ? (
    checksOut ? (
      heldByMe ? (
        <Button loading={leasing.state !== "idle"} onClick={checkIn} variant="ink">
          Check in
        </Button>
      ) : heldByOther ? (
        <Button disabled>Checked out</Button>
      ) : (
        <Button loading={leasing.state !== "idle"} onClick={checkOut}>
          Check out
        </Button>
      )
    ) : isCert ? (
      <Button onClick={() => setDialog("export")}>Export…</Button>
    ) : null
  ) : (
    <Button asChild>
      <Link to={`/requests?new=${encodeURIComponent(secret.id)}`}>Request access</Link>
    </Button>
  );

  return (
    <RevealRunProvider>
      <div className="flex flex-col gap-6">
        <PageHeader
          actions={
            <>
              <Button asChild variant="secondary">
                <Link to={`/browse/${secret.folderId}`}>
                  <ChevronLeft aria-hidden />
                  Back
                </Link>
              </Button>
              {primary}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary">
                    Actions
                    <ChevronDown aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-60">
                  <DropdownMenuItem asChild>
                    <Link to={`/secret/${secret.id}/edit`}>Edit</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={`/secret/${secret.id}/sharing`}>Manage access</Link>
                  </DropdownMenuItem>
                  {secret.typeId === SSH_TYPE && secret.targetId && read && !secret.retired && (
                    <DropdownMenuItem asChild>
                      <Link to={`/secret/${secret.id}/terminal`}>Open terminal</Link>
                    </DropdownMenuItem>
                  )}
                  {showManage && !secret.retired && isCert && (
                    <DropdownMenuItem disabled={!manage} onSelect={() => setDialog("replace")}>
                      Replace certificate…
                      {!manage && (
                        <span className="ml-auto text-[0.75rem] text-muted">
                          {OWNERS_ONLY_HINT}
                        </span>
                      )}
                    </DropdownMenuItem>
                  )}
                  {showManage && !secret.retired && type?.rotation && (
                    <DropdownMenuItem
                      disabled={!!lease || !manage}
                      onSelect={() => setDialog("rotate")}
                    >
                      Rotate now…
                      {manage ? (
                        lease && (
                          <span className="ml-auto text-[0.75rem] text-muted">check in first</span>
                        )
                      ) : (
                        <span className="ml-auto text-[0.75rem] text-muted">
                          {OWNERS_ONLY_HINT}
                        </span>
                      )}
                    </DropdownMenuItem>
                  )}
                  {showManage &&
                    (secret.retired ? (
                      <DropdownMenuItem disabled={!manage} onSelect={() => send("restore")}>
                        Restore
                        {!manage && (
                          <span className="ml-auto text-[0.75rem] text-muted">
                            {OWNERS_ONLY_HINT}
                          </span>
                        )}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem disabled={!manage} onSelect={() => send("retire")}>
                        Retire
                        {!manage && (
                          <span className="ml-auto text-[0.75rem] text-muted">
                            {OWNERS_ONLY_HINT}
                          </span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  {((read && !secret.retired) || showManage) && <DropdownMenuSeparator />}
                  {read && !secret.retired && (
                    <DropdownMenuItem
                      className="font-bold text-warn"
                      onSelect={() => openDialog("break-glass")}
                    >
                      <TriangleAlert aria-hidden className="size-4" />
                      Break glass…
                    </DropdownMenuItem>
                  )}
                  {showManage && (
                    <DropdownMenuItem
                      disabled={production && !isAdmin}
                      onSelect={() => setDialog("delete")}
                      tone="danger"
                    >
                      <span className="font-bold">Delete permanently…</span>
                      {production && !isAdmin && (
                        <span className="ml-auto text-[0.75rem] text-muted">admin only</span>
                      )}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          }
          eyebrow={
            <>
              Secret ·{" "}
              <Link className="font-bold text-primary underline" to={`/browse/${secret.folderId}`}>
                {path || "Folder"}
              </Link>
            </>
          }
          subtitle={type?.name}
          title={
            <span className="flex flex-wrap items-center gap-3">
              {secret.name}
              {secret.retired && <Badge tone="neutral">Retired</Badge>}
              {glassFields && (
                <Pill icon={<TriangleAlert aria-hidden />} tone="danger">
                  Break glass active
                </Pill>
              )}
              {secret.alwaysRequireApproval ? (
                <Pill icon={<ShieldCheck aria-hidden />} tone="primary">
                  Every reveal needs approval
                </Pill>
              ) : (
                secret.requireTokenApproval && (
                  <Pill icon={<ShieldCheck aria-hidden />} tone="primary">
                    Non-owners need approval
                  </Pill>
                )
              )}
            </span>
          }
        />

        {secret.retired && (
          <Banner
            action={
              manage && (
                <Button
                  loading={act.state !== "idle"}
                  onClick={() => send("restore")}
                  size="sm"
                  variant="ink"
                >
                  Restore
                </Button>
              )
            }
            body="It's hidden from folder lists, and nobody can reveal or check it out. Restore it to use it again."
            icon={<Ban aria-hidden className="size-4.5" />}
            title={`Retired on ${secret.retiredAt ? shortDate(secret.retiredAt) : "an earlier date"}`}
            tone="retired"
          />
        )}
        {expiry && expiry.days !== null && expiry.tone !== "ok" && !secret.retired && (
          <Banner
            action={
              manage && (
                <Button onClick={() => setDialog("replace")} size="sm" variant="ink">
                  Replace…
                </Button>
              )
            }
            body={
              expiry.tone === "danger"
                ? `It stopped being valid on ${shortDate(fields.notAfter ?? "")}. Replace it with a reissued certificate.`
                : `Replace it before ${shortDate(fields.notAfter ?? "")}, or services using ${secret.name} will start failing.`
            }
            icon={<Clock aria-hidden className="size-4.5" />}
            title={
              expiry.tone === "danger"
                ? "Expired"
                : `Expires in ${expiry.days} ${expiry.days === 1 ? "day" : "days"}`
            }
            tone={expiry.tone === "danger" ? "danger" : "warn"}
          />
        )}
        {glassFields && (
          <Alert role="alert" title="High-severity action recorded" tone="danger">
            You broke glass on this secret. The owners were notified, and it will rotate when you
            are done.
          </Alert>
        )}

        <div className="grid items-start gap-6 desktop:grid-cols-[minmax(0,1fr)_23.75rem]">
          <div className="flex min-w-0 flex-col gap-6">
            {glassFields && (
              <BreakGlassCard
                at={glassResult?.at ?? page.now}
                by={viewer?.name ?? "you"}
                fields={glassFields}
                onEnd={() => setGlassEnded(glassResult)}
                type={type}
              />
            )}
            {isCert ? (
              <CertificateCard
                fields={fields}
                keyLocked={lockedReason}
                now={page.now}
                onExport={read && !secret.retired ? () => setDialog("export") : undefined}
                onReplace={manage && !secret.retired ? () => setDialog("replace") : undefined}
              />
            ) : (
              type && (
                <FieldsCard
                  fields={fields}
                  locked={lockedReason}
                  plainHidden={!read}
                  rotatesOnCheckIn={!!type.checkout}
                  type={{ ...type, fields: type.fields.filter((f) => !CERT_META_KEYS.has(f.key)) }}
                />
              )
            )}
            {isDatabase && <DatabaseConnectionCard fields={fields} />}
            {history && (
              <HistoryCard
                locked={lockedReason}
                recovery={page.recovery}
                type={type}
                versions={history}
                viewerId={page.viewerId}
              />
            )}
          </div>
          <div className="flex min-w-0 flex-col gap-6">
            {checksOut && !secret.retired && (
              <CheckoutCard
                busy={leasing.state !== "idle"}
                hours={hours}
                onCheckIn={checkIn}
                onCheckOut={checkOut}
                onHours={setHours}
                page={page}
              />
            )}
            <Panel title="Details">
              <DetailsRows page={page} />
            </Panel>
            {(type?.rotation || type?.heartbeat) && <AutomationCard page={page} />}
            <AgentAccessCard page={page} />
          </div>
        </div>

        <StepUpDialog
          {...stepUp.dialog}
          description="Checking this secret out needs a fresh second factor."
        />
        <BreakGlassDialog
          fetcher={glass}
          name={secret.name}
          onOpenChange={(o) => setDialog(o ? "break-glass" : null)}
          open={dialog === "break-glass" && !(glassResult && glassResult !== glassSeen)}
        />
        <RotateDialog
          field={rotating}
          name={secret.name}
          onConfirm={() => send("rotate")}
          onOpenChange={(o) => setDialog(o ? "rotate" : null)}
          open={dialog === "rotate"}
          target={page.target?.name}
        />
        <DeleteDialog
          busy={act.state !== "idle"}
          name={secret.name}
          onConfirm={() => send("delete")}
          onOpenChange={(o) => setDialog(o ? "delete" : null)}
          open={dialog === "delete"}
          typeToConfirm={production}
        />
        {isCert && (
          <>
            <ExportDialog
              hasKey={fields.hasPrivateKey === "true"}
              onOpenChange={(o) => setDialog(o ? "export" : null)}
              open={dialog === "export"}
            />
            <ReplaceDialog
              onOpenChange={(o) => setDialog(o ? "replace" : null)}
              open={dialog === "replace"}
            />
          </>
        )}
      </div>
    </RevealRunProvider>
  );
};
