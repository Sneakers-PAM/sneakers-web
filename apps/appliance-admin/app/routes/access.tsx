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
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { Admin, Elevation, ListAdminsResponse, RevokedKey } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { access, elevation as elevationClient } from "@/lib/osadmin/client";
import { isStepUpRequired } from "@/lib/osadmin/errors";
import { useSession } from "@/lib/useSession";

export default function Access() {
  const { isOwner } = useSession();
  const [data, setData] = useState<ListAdminsResponse>();
  const [elevations, setElevations] = useState<Elevation[]>();
  const [name, setName] = useState("");
  const [role, setRole] = useState<Admin["role"]>("ROLE_ADMIN");
  const [newKeyAdmin, setNewKeyAdmin] = useState("");
  const [newKey, setNewKey] = useState("");
  const [quorumMembers, setQuorumMembers] = useState("");
  const [quorumRequired, setQuorumRequired] = useState(2);
  const [maxMinutes, setMaxMinutes] = useState(240);
  const [defaultMinutes, setDefaultMinutes] = useState(60);
  const [selfApproval, setSelfApproval] = useState(false);
  const [unrevoking, setUnrevoking] = useState<null | RevokedKey>(null);

  const reload = () =>
    void access.list().then((response) => {
      setData(response);
      setQuorumMembers((response.quorum?.members ?? []).join(", "));
      setQuorumRequired(response.quorum?.required ?? 2);
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
                      onClick={() =>
                        void runAction(() => access.removeAdmin(admin.name), { onSuccess: reload })
                      }
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
        <div className="flex flex-col gap-3 border-t border-border p-5.5">
          <p className="eyebrow">Add a login key</p>
          <div className="flex gap-2">
            <Select onValueChange={setNewKeyAdmin} value={newKeyAdmin}>
              <SelectTrigger aria-label="Admin">
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
            <Input
              mono
              onChange={(event) => setNewKey(event.target.value)}
              placeholder="ssh-ed25519 AAAA..."
              value={newKey}
            />
            <Button
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
            <div className="flex gap-2">
              <Field className="flex-1" label="Name">
                <Input onChange={(event) => setName(event.target.value)} value={name} />
              </Field>
              <Select onValueChange={(v) => setRole(v as Admin["role"])} value={role}>
                <SelectTrigger aria-label="Role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ROLE_ADMIN">admin</SelectItem>
                  <SelectItem value="ROLE_OWNER">owner</SelectItem>
                </SelectContent>
              </Select>
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
        <Table aria-label="Revoked login keys">
          <TableHead>
            <TableRow>
              <TableHeaderCell>Belonged to</TableHeaderCell>
              <TableHeaderCell>Key</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Revoked</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {revokedKeys.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>No revoked keys.</TableCell>
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
              const members = quorumMembers
                .split(",")
                .map((m) => m.trim())
                .filter(Boolean);
              void runAction(() => access.setQuorum(members, quorumRequired), {
                onSuccess: reload,
              });
            }}
          >
            <Field hint="Comma-separated admin names" label="Roster">
              <Input
                onChange={(event) => setQuorumMembers(event.target.value)}
                value={quorumMembers}
              />
            </Field>
            <Field label="Approvals required">
              <Input
                min={1}
                onChange={(event) => setQuorumRequired(Number(event.target.value))}
                type="number"
                value={quorumRequired}
              />
            </Field>
            <Button type="submit">Save quorum</Button>
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
