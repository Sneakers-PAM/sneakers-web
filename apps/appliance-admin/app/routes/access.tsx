import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  Input,
  Label,
  PageHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  shortDate,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  timeAgo,
  useBreakpoint,
} from "@sneakers-web/ui";
import { MoreVertical } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type {
  Admin,
  Elevation,
  Invitation,
  ListAdminsResponse,
  RevokedKey,
} from "@/lib/osadmin/types";

import { AccessSettingsCard } from "@/features/access/AccessSettingsCard";
import { AccountCard } from "@/features/access/AccountCard";
import { adminStatus } from "@/features/access/adminStatus";
import { InvitationDialog } from "@/features/access/InvitationDialog";
import { removeBlocked } from "@/features/access/removeBlocked";
import { RootShellsCard } from "@/features/access/RootShellsCard";
import { runAction } from "@/lib/osadmin/action";
import { access, elevation as elevationClient } from "@/lib/osadmin/client";
import { isNotAvailable, isStepUpRequired, reasonOf } from "@/lib/osadmin/errors";
import { useSession } from "@/lib/useSession";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

/** The fewest approvals a roster of `members` may ask for: 2 once there are two members. */
const leastRequired = (members: number): number => Math.min(2, Math.max(1, members));

export default function Access() {
  const { isOwner, session } = useSession();
  const phone = useBreakpoint() === "phone";
  const roleLabelId = useId();
  const [data, setData] = useState<ListAdminsResponse>();
  const [elevations, setElevations] = useState<Elevation[]>();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Admin["role"]>("ROLE_ADMIN");
  const [newRootOperator, setNewRootOperator] = useState(false);
  const [quorumMembers, setQuorumMembers] = useState<string[]>([]);
  const [quorumRequired, setQuorumRequired] = useState(2);
  const [removedFromRoster, setRemovedFromRoster] = useState<null | string>(null);
  const [unrevoking, setUnrevoking] = useState<null | RevokedKey>(null);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [reinviting, setReinviting] = useState<null | string>(null);
  const [removeRefusal, setRemoveRefusal] = useState<{ admin: string; reason: string } | null>(
    null,
  );

  const reload = () =>
    void access.list().then((response) => {
      setData(response);
      const members = (response.quorum?.members ?? []).filter((m) =>
        response.admins.some((admin) => admin.name === m),
      );
      setQuorumMembers(members);
      setQuorumRequired(
        clamp(
          response.quorum?.required ?? 2,
          leastRequired(members.length),
          Math.max(2, members.length),
        ),
      );
    });
  const reloadElevations = () =>
    void elevationClient.list().then((r) => setElevations(r.elevations));
  useEffect(() => {
    reload();
    reloadElevations();
  }, []);

  if (!data) return null;
  const revokedKeys = data.revokedKeys ?? [];
  const me = data.admins.find((admin) => admin.name === session?.admin);
  const unlock = (admin: Admin) =>
    void runAction(() => access.unlockAdmin(admin.name), {
      onSuccess: reload,
      successMessage: `${admin.name} is unlocked.`,
    });
  // The box's own refusal (the last owner, say) stays on the page by the list, not a toast.
  const removeAdmin = (admin: Admin) => {
    const onRoster = quorumMembers.includes(admin.name);
    setRemoveRefusal(null);
    void runAction(
      async () => {
        try {
          await access.removeAdmin(admin.name);
          return true;
        } catch (error) {
          if (isStepUpRequired(error) || isNotAvailable(error)) throw error;
          setRemoveRefusal({ admin: admin.name, reason: reasonOf(error) });
          return false;
        }
      },
      {
        onSuccess: (removed) => {
          if (!removed) return;
          reload();
          if (onRoster) setRemovedFromRoster(admin.name);
        },
      },
    );
  };
  const removeKey = (admin: Admin, fingerprint: string) =>
    void runAction(() => access.removeKey(admin.name, fingerprint), { onSuccess: reload });

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Access" />
      <Card>
        <CardHeader title="Admins" />
        {removeRefusal && (
          <div className="px-5.5 pt-5.5">
            <Alert title={`${removeRefusal.admin} wasn't removed`} tone="danger">
              {removeRefusal.reason}
            </Alert>
          </div>
        )}
        {phone ? (
          <ul className="flex flex-col gap-3 p-5.5">
            {data.admins.map((admin) => (
              <AdminCard
                admin={admin}
                isOwner={isOwner}
                isSelf={admin.name === session?.admin}
                key={admin.name}
                onReinvite={() => setReinviting(admin.name)}
                onRemoveAdmin={() => removeAdmin(admin)}
                onRemoveKey={(fingerprint) => removeKey(admin, fingerprint)}
                onUnlock={() => unlock(admin)}
                removeBlocked={removeBlocked(admin, data.admins, session?.admin)}
              />
            ))}
          </ul>
        ) : (
          <Table aria-label="Admins">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Sign-in</TableHeaderCell>
                <TableHeaderCell>SSH keys</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {data.admins.map((admin) => {
                const status = adminStatus(admin);
                const self = admin.name === session?.admin;
                const blocked = removeBlocked(admin, data.admins, session?.admin);
                const blockedId = `remove-blocked-${admin.name}`;
                return (
                  <TableRow key={admin.name}>
                    <TableCell>{admin.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone={admin.role === "ROLE_OWNER" ? "primary" : "neutral"}>
                          {admin.role === "ROLE_OWNER" ? "owner" : "admin"}
                        </Badge>
                        {admin.rootOperator && <Badge tone="warn">root operator</Badge>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge className="w-max" tone={status.tone}>
                          {status.label}
                        </Badge>
                        {admin.lastSignIn && (
                          <span className="text-small text-muted">
                            Last signed in {timeAgo(admin.lastSignIn)}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ul className="flex flex-col gap-1">
                        {admin.keys.map((key) => (
                          <li
                            className="flex items-center gap-2 font-mono text-[0.8125rem]"
                            key={key.fingerprint}
                          >
                            <span className="min-w-0 truncate">
                              {key.comment ? `${key.comment}: ` : ""}
                              {key.fingerprint}
                              {key.validBefore ? ` (until ${shortDate(key.validBefore)})` : ""}
                            </span>
                            {(isOwner || self) && (
                              <Button
                                onClick={() => removeKey(admin, key.fingerprint)}
                                size="xs"
                                variant="secondary"
                              >
                                Remove
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </TableCell>
                    <TableCell>
                      {isOwner && (
                        <div className="flex flex-wrap justify-end gap-2">
                          {status.locked && (
                            <Button onClick={() => unlock(admin)} size="sm">
                              Unlock
                            </Button>
                          )}
                          {!self && (
                            <Button
                              onClick={() => setReinviting(admin.name)}
                              size="sm"
                              variant="secondary"
                            >
                              Re-invite
                            </Button>
                          )}
                          <div className="flex flex-col items-end gap-1">
                            <Button
                              aria-describedby={blocked ? blockedId : undefined}
                              disabled={!!blocked}
                              onClick={() => removeAdmin(admin)}
                              size="sm"
                              variant="secondary"
                            >
                              Remove admin
                            </Button>
                            {blocked && (
                              <span className="text-small text-muted" id={blockedId}>
                                {blocked}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        {isOwner && (
          <form
            aria-label="Add an admin"
            className="flex flex-col gap-3 border-t border-border p-5.5"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(() => access.addAdmin(name.trim(), role, newRootOperator), {
                onSuccess: (response) => {
                  setName("");
                  setNewRootOperator(false);
                  setInvitation(response.invitation);
                  reload();
                },
              });
            }}
          >
            <p className="eyebrow">Add an admin</p>
            <div className="flex flex-col gap-2 tablet:flex-row">
              <Field className="w-full tablet:flex-1" label="Name">
                <Input onChange={(event) => setName(event.target.value)} value={name} />
              </Field>
              <div className="flex w-full flex-col gap-2 tablet:w-32 tablet:shrink-0">
                <Label id={roleLabelId}>Role</Label>
                <Select onValueChange={(v) => setRole(v as Admin["role"])} value={role}>
                  <SelectTrigger aria-labelledby={roleLabelId}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ROLE_ADMIN">admin</SelectItem>
                    <SelectItem value="ROLE_OWNER">owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Label className="flex items-center gap-2">
              <Checkbox
                checked={newRootOperator}
                onCheckedChange={(checked) => setNewRootOperator(checked === true)}
              />
              Make them a root operator (they may open the root shell)
            </Label>
            <p className="m-0 text-small text-muted">
              The new admin gets a one-time invitation code to set their own password and
              authenticator.
            </p>
            <Button disabled={!name.trim()} type="submit">
              Add admin
            </Button>
          </form>
        )}
      </Card>
      <Dialog onOpenChange={(open) => !open && setInvitation(null)} open={!!invitation}>
        {invitation && (
          <InvitationDialog invitation={invitation} onDone={() => setInvitation(null)} />
        )}
      </Dialog>
      <Dialog onOpenChange={(open) => !open && setReinviting(null)} open={!!reinviting}>
        {reinviting && (
          <ReinviteDialog
            admin={reinviting}
            onCancel={() => setReinviting(null)}
            onDone={(next) => {
              setReinviting(null);
              setInvitation(next);
              reload();
            }}
          />
        )}
      </Dialog>
      {me && <AccountCard me={me} onChanged={reload} />}
      <Card>
        <CardHeader title="Revoked login keys" />
        <p className="px-5.5 pt-4 text-small text-muted">
          A removed login key stays on sshd&apos;s revocation list, so it can&apos;t sign in or be
          added to any admin, until an owner un-revokes it.
        </p>
        {phone ? (
          <ul className="flex flex-col gap-3 p-5.5 pt-0">
            {revokedKeys.length === 0 && (
              <li className="text-small text-muted">No revoked keys.</li>
            )}
            {revokedKeys.map((key) => (
              <RevokedKeyCard
                isOwner={isOwner}
                key={key.fingerprint}
                onUnrevoke={() => setUnrevoking(key)}
                revokedKey={key}
              />
            ))}
          </ul>
        ) : (
          <Table aria-label="Revoked login keys">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Belonged to</TableHeaderCell>
                <TableHeaderCell>Key</TableHeaderCell>
                <TableHeaderCell>Type</TableHeaderCell>
                <TableHeaderCell>Revoked</TableHeaderCell>
                <TableHeaderCell>Revoked by</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {revokedKeys.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>No revoked keys.</TableCell>
                </TableRow>
              )}
              {revokedKeys.map((key) => (
                <TableRow key={key.fingerprint}>
                  <TableCell>{key.admin}</TableCell>
                  <TableCell className="font-mono text-[0.8125rem] break-all">
                    {key.fingerprint}
                  </TableCell>
                  <TableCell>{key.type}</TableCell>
                  <TableCell>{key.revoked ? shortDate(key.revoked) : ""}</TableCell>
                  <TableCell>{key.revokedBy || "unknown"}</TableCell>
                  <TableCell>
                    {isOwner && (
                      <Button onClick={() => setUnrevoking(key)} size="sm" variant="secondary">
                        Un-revoke
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      <Dialog onOpenChange={(open) => !open && setUnrevoking(null)} open={!!unrevoking}>
        {unrevoking && (
          <UnrevokeDialog
            onCancel={() => setUnrevoking(null)}
            onDone={() => {
              setUnrevoking(null);
              reload();
            }}
            revokedKey={unrevoking}
          />
        )}
      </Dialog>
      <Card>
        <CardHeader title="Key fingerprints" />
        <div className="flex flex-col gap-1 p-5.5 font-mono text-[0.8125rem]">
          {data.rootKey && (
            <p>
              Root key {data.rootKey.type} {data.rootKey.fingerprint}
            </p>
          )}
          {data.hostKeys.map((key) => (
            <p key={key.fingerprint}>
              SSH host key {key.type} {key.fingerprint}
            </p>
          ))}
        </div>
      </Card>
      {isOwner && <AccessSettingsCard onSaved={reload} policy={data.accessPolicy} />}
      {isOwner && (
        <Card>
          <CardHeader title="Root operators" />
          <form
            className="flex flex-col gap-3 p-5.5"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(() => access.setQuorum(quorumMembers, quorumRequired), {
                onSuccess: reload,
              });
            }}
          >
            <p className="m-0 text-small text-muted">
              Root operators may open the root shell, with a code from the Root shell page. The same
              roster approves a factory reset.
            </p>
            {removedFromRoster && (
              <Alert tone="info">
                {removedFromRoster} was removed from the root-operator roster.
              </Alert>
            )}
            {data.admins.length < 2 && (
              <Alert tone="info">A single-admin box can&apos;t factory reset.</Alert>
            )}
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[0.875rem] font-bold text-ink">Roster</legend>
              {data.admins.map((admin) => (
                <Label className="flex items-center gap-2" key={admin.name}>
                  <Checkbox
                    checked={quorumMembers.includes(admin.name)}
                    onCheckedChange={(checked) => {
                      const next =
                        checked === true
                          ? [...quorumMembers, admin.name]
                          : quorumMembers.filter((m) => m !== admin.name);
                      setQuorumMembers(next);
                      setQuorumRequired((required) =>
                        clamp(required, leastRequired(next.length), Math.max(2, next.length)),
                      );
                    }}
                  />
                  {admin.name} ({admin.role === "ROLE_OWNER" ? "owner" : "admin"})
                </Label>
              ))}
            </fieldset>
            <Field hint="For a factory reset" label="Approvals required">
              <Input
                max={Math.max(2, quorumMembers.length)}
                min={leastRequired(quorumMembers.length)}
                onChange={(event) =>
                  setQuorumRequired(
                    clamp(
                      Number(event.target.value),
                      leastRequired(quorumMembers.length),
                      Math.max(2, quorumMembers.length),
                    ),
                  )
                }
                type="number"
                value={quorumRequired}
              />
            </Field>
            <Button disabled={quorumMembers.length === 0} type="submit">
              Save roster
            </Button>
          </form>
        </Card>
      )}
      <RootShellsCard
        elevations={elevations ?? []}
        isOwner={isOwner}
        onChanged={reloadElevations}
      />
    </div>
  );
}

/** An admin's row as a card, for phone widths: no horizontal scroll, actions behind a menu. */
const AdminCard = ({
  admin,
  isOwner,
  isSelf,
  onReinvite,
  onRemoveAdmin,
  onRemoveKey,
  onUnlock,
  removeBlocked: blocked,
}: {
  admin: Admin;
  isOwner: boolean;
  isSelf: boolean;
  onReinvite: () => void;
  onRemoveAdmin: () => void;
  onRemoveKey: (fingerprint: string) => void;
  onUnlock: () => void;
  /** Why Remove admin is off for this admin, if it is. */
  removeBlocked?: string;
}) => {
  const status = adminStatus(admin);
  return (
    <li
      aria-label={admin.name}
      className="flex flex-col gap-2 rounded-lg border border-border p-4"
      role="group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <b className="text-body-lg">{admin.name}</b>
          <div className="flex flex-wrap gap-1.5">
            <Badge className="w-max" tone={admin.role === "ROLE_OWNER" ? "primary" : "neutral"}>
              {admin.role === "ROLE_OWNER" ? "owner" : "admin"}
            </Badge>
            {admin.rootOperator && <Badge tone="warn">root operator</Badge>}
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
        </div>
        {(isOwner || admin.keys.length > 0) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label={`Actions for ${admin.name}`} size="icon-sm" variant="secondary">
                <MoreVertical aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {admin.keys.map((key) => (
                <DropdownMenuItem
                  key={key.fingerprint}
                  onSelect={() => onRemoveKey(key.fingerprint)}
                >
                  Remove the {key.type} key
                </DropdownMenuItem>
              ))}
              {isOwner && status.locked && (
                <DropdownMenuItem onSelect={onUnlock}>Unlock</DropdownMenuItem>
              )}
              {isOwner && !isSelf && (
                <DropdownMenuItem onSelect={onReinvite}>Re-invite</DropdownMenuItem>
              )}
              {isOwner && (
                <DropdownMenuItem disabled={!!blocked} onSelect={onRemoveAdmin} tone="danger">
                  <span className="flex flex-col gap-0.5">
                    Remove admin
                    {blocked && <span className="text-small text-muted">{blocked}</span>}
                  </span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {admin.keys.length > 0 && (
        <ul className="flex flex-col gap-1">
          {admin.keys.map((key) => (
            <li className="truncate font-mono text-[0.8125rem] text-muted" key={key.fingerprint}>
              {key.fingerprint} ({key.type})
            </li>
          ))}
        </ul>
      )}
    </li>
  );
};

/** Owner, step-up: clears the admin's password and authenticator, and gives a new code. */
const ReinviteDialog = ({
  admin,
  onCancel,
  onDone,
}: {
  admin: string;
  onCancel: () => void;
  onDone: (invitation: Invitation) => void;
}) => (
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Re-invite {admin}</DialogTitle>
      <DialogDescription>
        {admin}&apos;s password and authenticator are cleared and their sessions end. They set new
        ones with the invitation code. Use this when they lost their authenticator.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button onClick={onCancel} variant="secondary">
        Cancel
      </Button>
      <Button
        onClick={() =>
          void runAction(() => access.reinviteAdmin(admin), {
            onSuccess: (response) => onDone(response.invitation),
          })
        }
        variant="danger"
      >
        Re-invite {admin}
      </Button>
    </DialogFooter>
  </DialogContent>
);

/** A revoked key's row as a card, for phone widths. */
const RevokedKeyCard = ({
  isOwner,
  onUnrevoke,
  revokedKey,
}: {
  isOwner: boolean;
  onUnrevoke: () => void;
  revokedKey: RevokedKey;
}) => (
  <li className="flex flex-col gap-1.5 rounded-lg border border-border p-4">
    <div className="flex items-start justify-between gap-2">
      <div className="flex min-w-0 flex-col gap-1 text-small">
        <span className="truncate font-mono">{revokedKey.fingerprint}</span>
        <span className="text-muted">
          {revokedKey.type} · belonged to {revokedKey.admin}
        </span>
        <span className="text-muted">
          {revokedKey.revoked ? `${shortDate(revokedKey.revoked)} · ` : ""}revoked by{" "}
          {revokedKey.revokedBy || "unknown"}
        </span>
      </div>
      {isOwner && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              aria-label={`Actions for ${revokedKey.fingerprint}`}
              size="icon-sm"
              variant="secondary"
            >
              <MoreVertical aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onSelect={onUnrevoke}>Un-revoke</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  </li>
);

/** Owner, step-up: the key comes off the revocation list; it isn't added back to anyone. */
const UnrevokeDialog = ({
  onCancel,
  onDone,
  revokedKey,
}: {
  onCancel: () => void;
  onDone: () => void;
  revokedKey: RevokedKey;
}) => {
  const [refusal, setRefusal] = useState("");
  const submit = () => {
    setRefusal("");
    void runAction(
      async () => {
        try {
          await access.unrevokeKey(revokedKey.fingerprint);
          return true;
        } catch (error) {
          if (isStepUpRequired(error)) throw error;
          setRefusal(error instanceof Error ? error.message : "The appliance refused.");
          return false;
        }
      },
      { onSuccess: (done) => done && onDone() },
    );
  };
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Un-revoke {revokedKey.admin}&apos;s key</DialogTitle>
        <DialogDescription>
          The key comes off sshd&apos;s revocation list, so it can be added to an admin again. It
          isn&apos;t added back to anyone by this.
        </DialogDescription>
      </DialogHeader>
      <p className="font-mono text-[0.8125rem] break-all">
        {revokedKey.type} {revokedKey.fingerprint}
      </p>
      {refusal && <Alert tone="danger">{refusal}</Alert>}
      <DialogFooter>
        <Button onClick={onCancel} variant="secondary">
          Cancel
        </Button>
        <Button onClick={submit} variant="danger">
          Un-revoke key
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};
