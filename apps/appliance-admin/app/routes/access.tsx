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
  useBreakpoint,
} from "@sneakers-web/ui";
import { MoreVertical } from "lucide-react";
import { useEffect, useId, useState } from "react";

import type { Admin, Elevation, ListAdminsResponse, RevokedKey } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { access, elevation as elevationClient } from "@/lib/osadmin/client";
import { isStepUpRequired } from "@/lib/osadmin/errors";
import { useSession } from "@/lib/useSession";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export default function Access() {
  const { isOwner } = useSession();
  const phone = useBreakpoint() === "phone";
  const roleLabelId = useId();
  const newKeyAdminLabelId = useId();
  const [data, setData] = useState<ListAdminsResponse>();
  const [elevations, setElevations] = useState<Elevation[]>();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Admin["role"]>("ROLE_ADMIN");
  const [newKeyAdmin, setNewKeyAdmin] = useState("");
  const [newKey, setNewKey] = useState("");
  const [quorumMembers, setQuorumMembers] = useState<string[]>([]);
  const [quorumRequired, setQuorumRequired] = useState(2);
  const [removedFromRoster, setRemovedFromRoster] = useState<null | string>(null);
  const [maxMinutes, setMaxMinutes] = useState(240);
  const [defaultMinutes, setDefaultMinutes] = useState(60);
  const [selfApproval, setSelfApproval] = useState(false);
  const [unrevoking, setUnrevoking] = useState<null | RevokedKey>(null);

  const reload = () =>
    void access.list().then((response) => {
      setData(response);
      const members = (response.quorum?.members ?? []).filter((m) =>
        response.admins.some((admin) => admin.name === m),
      );
      setQuorumMembers(members);
      setQuorumRequired(clamp(response.quorum?.required ?? 2, 2, Math.max(2, members.length)));
      setMaxMinutes(response.elevationPolicy?.maxMinutes ?? 240);
      setDefaultMinutes(response.elevationPolicy?.defaultMinutes ?? 60);
      setSelfApproval(response.elevationPolicy?.selfApprovalWhenSingleOwner ?? false);
    });
  const reloadElevations = () =>
    void elevationClient.list().then((r) => setElevations(r.elevations));
  useEffect(() => {
    reload();
    reloadElevations();
  }, []);

  if (!data) return null;
  const revokedKeys = data.revokedKeys ?? [];

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="Access" />
      <Card>
        <CardHeader title="Admins" />
        {phone ? (
          <ul className="flex flex-col gap-3 p-5.5">
            {data.admins.map((admin) => (
              <AdminCard
                admin={admin}
                isOwner={isOwner}
                key={admin.name}
                onRemoveAdmin={() => {
                  const onRoster = quorumMembers.includes(admin.name);
                  void runAction(() => access.removeAdmin(admin.name), {
                    onSuccess: () => {
                      reload();
                      if (onRoster) setRemovedFromRoster(admin.name);
                    },
                  });
                }}
                onRemoveKey={(fingerprint) =>
                  void runAction(() => access.removeKey(admin.name, fingerprint), {
                    onSuccess: reload,
                  })
                }
              />
            ))}
          </ul>
        ) : (
          <Table aria-label="Admins">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Role</TableHeaderCell>
                <TableHeaderCell>Keys</TableHeaderCell>
                <TableHeaderCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {data.admins.map((admin) => (
                <TableRow key={admin.name}>
                  <TableCell>{admin.name}</TableCell>
                  <TableCell>
                    <Badge tone={admin.role === "ROLE_OWNER" ? "primary" : "neutral"}>
                      {admin.role === "ROLE_OWNER" ? "owner" : "admin"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <ul className="flex flex-col gap-1">
                      {admin.keys.map((key) => (
                        <li
                          className="flex items-center gap-2 font-mono text-[0.8125rem]"
                          key={key.fingerprint}
                        >
                          {key.fingerprint} ({key.type})
                          <Button
                            onClick={() =>
                              void runAction(() => access.removeKey(admin.name, key.fingerprint), {
                                onSuccess: reload,
                              })
                            }
                            size="xs"
                            variant="secondary"
                          >
                            Remove
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </TableCell>
                  <TableCell>
                    {isOwner && (
                      <Button
                        onClick={() => {
                          const onRoster = quorumMembers.includes(admin.name);
                          void runAction(() => access.removeAdmin(admin.name), {
                            onSuccess: () => {
                              reload();
                              if (onRoster) setRemovedFromRoster(admin.name);
                            },
                          });
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        Remove admin
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <div
          aria-label="Add a login key"
          className="flex flex-col gap-3 border-t border-border p-5.5"
          role="group"
        >
          <p className="eyebrow">Add a login key</p>
          <div className="flex flex-col gap-2 tablet:flex-row">
            <div className="flex w-full flex-col gap-2 tablet:w-40 tablet:shrink-0">
              <Label id={newKeyAdminLabelId}>Admin</Label>
              <Select onValueChange={setNewKeyAdmin} value={newKeyAdmin}>
                <SelectTrigger aria-labelledby={newKeyAdminLabelId}>
                  <SelectValue placeholder="Admin" />
                </SelectTrigger>
                <SelectContent>
                  {data.admins.map((admin) => (
                    <SelectItem key={admin.name} value={admin.name}>
                      {admin.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field className="w-full tablet:flex-1" label="Key">
              <Input
                mono
                onChange={(event) => setNewKey(event.target.value)}
                placeholder="ssh-ed25519 AAAA..."
                value={newKey}
              />
            </Field>
            <Button
              className="self-end"
              disabled={!newKeyAdmin || !newKey}
              onClick={() =>
                void runAction(() => access.addKey(newKeyAdmin, newKey), {
                  onSuccess: () => {
                    setNewKey("");
                    reload();
                  },
                })
              }
            >
              Add
            </Button>
          </div>
        </div>
        {isOwner && (
          <form
            aria-label="Add an admin"
            className="flex flex-col gap-3 border-t border-border p-5.5"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(() => access.addAdmin(name, role), {
                onSuccess: () => {
                  setName("");
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
            <Button disabled={!name} type="submit">
              Add admin
            </Button>
          </form>
        )}
      </Card>
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
        <CardHeader title="Host key fingerprints" />
        <div className="flex flex-col gap-1 p-5.5 font-mono text-[0.8125rem]">
          {data.hostKeys.map((key) => (
            <p key={key.fingerprint}>
              {key.type} {key.fingerprint}
            </p>
          ))}
        </div>
      </Card>
      {isOwner && (
        <Card>
          <CardHeader title="Elevation policy" />
          <form
            className="flex flex-col gap-3 p-5.5"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(
                () =>
                  access.setElevationPolicy({
                    defaultMinutes,
                    maxMinutes,
                    selfApprovalWhenSingleOwner: selfApproval,
                  }),
                { onSuccess: reload },
              );
            }}
          >
            <Field label="Default minutes">
              <Input
                onChange={(event) => setDefaultMinutes(Number(event.target.value))}
                type="number"
                value={defaultMinutes}
              />
            </Field>
            <Field label="Maximum minutes">
              <Input
                onChange={(event) => setMaxMinutes(Number(event.target.value))}
                type="number"
                value={maxMinutes}
              />
            </Field>
            <Label className="flex items-center gap-2">
              <Checkbox
                checked={selfApproval}
                onCheckedChange={(checked) => setSelfApproval(checked === true)}
              />
              A single owner may self-approve elevation
            </Label>
            <Button type="submit">Save policy</Button>
          </form>
        </Card>
      )}
      {isOwner && (
        <Card>
          <CardHeader title="Factory-reset quorum" />
          <form
            className="flex flex-col gap-3 p-5.5"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(() => access.setQuorum(quorumMembers, quorumRequired), {
                onSuccess: reload,
              });
            }}
          >
            {removedFromRoster && (
              <Alert tone="info">
                {removedFromRoster} was removed from the factory-reset quorum roster.
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
                      setQuorumRequired((required) => clamp(required, 2, Math.max(2, next.length)));
                    }}
                  />
                  {admin.name} ({admin.role === "ROLE_OWNER" ? "owner" : "admin"})
                </Label>
              ))}
            </fieldset>
            <Field label="Approvals required">
              <Input
                max={Math.max(2, quorumMembers.length)}
                min={2}
                onChange={(event) =>
                  setQuorumRequired(
                    clamp(Number(event.target.value), 2, Math.max(2, quorumMembers.length)),
                  )
                }
                type="number"
                value={quorumRequired}
              />
            </Field>
            <Button disabled={quorumMembers.length < 2} type="submit">
              Save quorum
            </Button>
          </form>
        </Card>
      )}
      <Card>
        <CardHeader title="Shell elevation requests" />
        <Table aria-label="Shell elevation requests">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Admin</TableHeaderCell>
              <TableHeaderCell>Reason</TableHeaderCell>
              <TableHeaderCell>Minutes</TableHeaderCell>
              <TableHeaderCell>State</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {(elevations ?? []).map((request) => (
              <TableRow key={request.id}>
                <TableCell>{request.admin}</TableCell>
                <TableCell>{request.reason}</TableCell>
                <TableCell>{request.minutes}</TableCell>
                <TableCell>{request.state}</TableCell>
                <TableCell>
                  {request.state === "pending" && isOwner && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() =>
                          void runAction(() => elevationClient.approve(request.id), {
                            onSuccess: reloadElevations,
                          })
                        }
                        size="sm"
                      >
                        Approve
                      </Button>
                      <Button
                        onClick={() =>
                          void runAction(() => elevationClient.deny(request.id), {
                            onSuccess: reloadElevations,
                          })
                        }
                        size="sm"
                        variant="secondary"
                      >
                        Deny
                      </Button>
                    </div>
                  )}
                  {request.state === "active" && isOwner && (
                    <Button
                      onClick={() =>
                        void runAction(() => elevationClient.terminate(request.id), {
                          onSuccess: reloadElevations,
                        })
                      }
                      size="sm"
                      variant="danger"
                    >
                      Terminate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

/** An admin's row as a card, for phone widths: no horizontal scroll, actions behind a menu. */
const AdminCard = ({
  admin,
  isOwner,
  onRemoveAdmin,
  onRemoveKey,
}: {
  admin: Admin;
  isOwner: boolean;
  onRemoveAdmin: () => void;
  onRemoveKey: (fingerprint: string) => void;
}) => (
  <li
    aria-label={admin.name}
    className="flex flex-col gap-2 rounded-lg border border-border p-4"
    role="group"
  >
    <div className="flex items-start justify-between gap-2">
      <div className="flex flex-col gap-1.5">
        <b className="text-body-lg">{admin.name}</b>
        <Badge className="w-max" tone={admin.role === "ROLE_OWNER" ? "primary" : "neutral"}>
          {admin.role === "ROLE_OWNER" ? "owner" : "admin"}
        </Badge>
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
              <DropdownMenuItem key={key.fingerprint} onSelect={() => onRemoveKey(key.fingerprint)}>
                Remove the {key.type} key
              </DropdownMenuItem>
            ))}
            {isOwner && (
              <DropdownMenuItem onSelect={onRemoveAdmin} tone="danger">
                Remove admin
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
