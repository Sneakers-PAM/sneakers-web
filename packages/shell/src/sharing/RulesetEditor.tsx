import {
  Alert,
  Avatar,
  Button,
  Card,
  CardHeader,
  Checkbox,
  cn,
  Segmented,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { ArrowDown, ArrowUp, Check, Globe, Lock, Users, X } from "lucide-react";
import { useId, useState } from "react";

import type {
  InheritedRule,
  RaciActionKey,
  RaciGrantValue,
  RulesetDraft,
  RulesetEditorProps,
  RulesetRule,
  RulesetSubject,
} from "#shell/sharing/types";

import { addRule, cycleGrant, moveRule, removeRule, setGrant } from "#shell/sharing/draft";
import { SubjectPicker } from "#shell/sharing/SubjectPicker";
import { RACI_ACTIONS } from "#shell/sharing/types";

type View = "advanced" | "simple";

const LABEL = Object.fromEntries(RACI_ACTIONS.map((a) => [a.key, a.label])) as Record<
  RaciActionKey,
  string
>;
/** Simple view puts the everyday actions first. */
const SIMPLE_ORDER: RaciActionKey[] = ["C", "R", "A", "I"];
const META = { everyone: "Anyone who can sign in", group: "Group", user: "Person" };
const EVERYONE_NOTE = "Only a site admin can change rules for everyone.";

const SubjectCell = ({ name, subject }: { name: string; subject: RulesetSubject }) => (
  <span className="flex min-w-0 items-center gap-2.5">
    {subject.kind === "user" ? (
      <Avatar name={name} size={30} />
    ) : (
      <span
        aria-hidden
        className="flex size-7.5 shrink-0 items-center justify-center rounded-[8px] bg-sunken text-ink"
      >
        {subject.kind === "group" ? <Users className="size-4" /> : <Globe className="size-4" />}
      </span>
    )}
    <span className="flex min-w-0 flex-col gap-0.5">
      <b className="truncate text-body leading-[1.2] font-bold">{name}</b>
      <span className="text-small text-muted">{META[subject.kind]}</span>
    </span>
  </span>
);

const cellLook = (value: RaciGrantValue | undefined, inherited: boolean) => {
  if (value === "allow") {
    return {
      className: inherited ? "rounded-full bg-ok-soft text-ok" : "rounded-full bg-ok text-surface",
      mark: <Check aria-hidden className="size-4.5" strokeWidth={3} />,
    };
  }
  if (value === "deny") {
    return {
      className:
        "rounded-[4px] border-2 border-danger text-danger bg-[repeating-linear-gradient(135deg,var(--color-danger-soft)_0_4px,var(--color-surface)_4px_8px)]",
      mark: <X aria-hidden className="size-4.5" strokeWidth={3} />,
    };
  }
  return {
    className: "rounded-[10px] border-[1.5px] border-dashed border-control text-muted",
    mark: <span aria-hidden>·</span>,
  };
};

const Legend = () => (
  <div className="flex flex-wrap gap-4 text-small text-muted">
    {(["allow", "deny", undefined] as const).map((v) => {
      const look = cellLook(v, false);
      return (
        <span className="flex items-center gap-1.5" key={v ?? "blank"}>
          <span className={cn("flex size-5.5 items-center justify-center", look.className)}>
            {look.mark}
          </span>
          {v === "allow" ? "Allow" : v === "deny" ? "Deny" : "Blank"}
        </span>
      );
    })}
  </div>
);

/** Inherited rules grouped by the folder they come from, nearest first. */
const byFolder = (inherited: InheritedRule[]) => {
  const groups: { id: string; name: string; rules: InheritedRule[] }[] = [];
  for (const r of inherited) {
    const g = groups.find((x) => x.id === r.fromFolderId);
    if (g) g.rules.push(r);
    else groups.push({ id: r.fromFolderId, name: r.fromFolderName, rules: [r] });
  }
  return groups;
};

/**
 * The RACI ruleset editor shared by the staff sharing screen and the admin console's folders.
 * Owners (folders only), this folder's or secret's own rules, and the read-only rules inherited
 * from the folders above, in a Simple view (ticks) and an Advanced one (the tri-state RACI grid).
 *
 * Pure UI: it makes no gateway calls. It starts from `value`, keeps the draft itself, and hands
 * the whole draft to `onChange` on every edit; remount it with a new `key` to reset it. The app
 * saves the draft through its own action with `toRaciRuleInput`.
 *
 * - `scope`: "folder" shows owners; "secret" has none (ownership lives on the folder).
 * - `inherited`, `inheritedOwners`: shown locked, tagged with the folder they come from.
 * - `labels`: display names for user ids in owners and rules.
 * - `subjectOptions`, `searchSubjects`: what the people-and-groups picker offers.
 * - `readOnlyReason`: everything is shown, nothing can change, and the sentence says why.
 * - `canEditEveryone`: only site admins may change "everyone" rules; false keeps them locked.
 */
export const RulesetEditor = ({
  canEditEveryone = false,
  inherited,
  inheritedOwners = [],
  labels,
  onChange,
  readOnlyReason,
  scope,
  searchSubjects,
  subjectOptions,
  value,
}: RulesetEditorProps) => {
  const [draft, setDraft] = useState<RulesetDraft>(value);
  const [view, setView] = useState<View>("simple");
  const [known, setKnown] = useState<Record<string, string>>({});
  const ownersHeading = useId();
  const inheritedHeading = useId();
  const readOnly = readOnlyReason !== undefined;

  const change = (next: RulesetDraft) => {
    setDraft(next);
    onChange(next);
  };
  const setRules = (rules: RulesetRule[]) => change({ ...draft, rules });

  const nameOf = (s: RulesetSubject) =>
    s.kind === "user" && s.id ? (labels[s.id] ?? known[s.id] ?? s.name) : s.name;
  const nameOfUser = (id: string) => labels[id] ?? known[id] ?? id;
  const locked = (r: RulesetRule) =>
    readOnly || (r.subject.kind === "everyone" && !canEditEveryone);
  const everyoneLocked =
    !readOnly && !canEditEveryone && draft.rules.some((r) => r.subject.kind === "everyone");

  const pickerOptions: RulesetSubject[] = [
    ...(canEditEveryone ? [{ kind: "everyone" as const, name: "Everyone" }] : []),
    ...subjectOptions,
  ];
  const addSubject = (subject: RulesetSubject) => {
    if (subject.kind === "user" && subject.id)
      setKnown((k) => ({ ...k, [subject.id as string]: subject.name }));
    setRules(addRule(draft.rules, subject, view === "simple" ? { C: "allow" } : {}));
  };
  const picker = (label: string) =>
    readOnly ? null : (
      <SubjectPicker
        exclude={draft.rules.map((r) => r.subject)}
        label={label}
        onPick={addSubject}
        options={pickerOptions}
        search={searchSubjects}
      />
    );

  const owners = draft.owners ?? [];
  const searchPeople = searchSubjects
    ? async (q: string) => {
        const found = await searchSubjects(q);
        return found.filter((s) => s.kind === "user");
      }
    : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-5.5">
      {readOnly && (
        <Alert role="status" tone="info">
          {readOnlyReason}
        </Alert>
      )}

      {scope === "folder" && (
        <Card aria-labelledby={ownersHeading} className="flex flex-col gap-3.5 px-6 py-5">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2
              className="m-0 font-display text-[1.25rem] leading-none font-bold"
              id={ownersHeading}
            >
              Owners
            </h2>
            <span className="text-[0.875rem] text-muted">
              Owners can always Reveal, Approve and Manage, here and in every subfolder.
            </span>
          </div>
          <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0">
            {owners.map((id) => (
              <li
                className="flex items-center gap-2 rounded-md border-[1.5px] border-border-strong bg-surface py-1.25 pr-1.5 pl-1.25"
                key={id}
              >
                <Avatar name={nameOfUser(id)} size={28} />
                <b className="text-[0.875rem] font-bold">{nameOfUser(id)}</b>
                {!readOnly && owners.length > 1 && (
                  <Button
                    aria-label={`Remove owner ${nameOfUser(id)}`}
                    onClick={() => change({ ...draft, owners: owners.filter((o) => o !== id) })}
                    size="icon-sm"
                    variant="ghost"
                  >
                    <X aria-hidden />
                  </Button>
                )}
              </li>
            ))}
            {inheritedOwners.map((o) => (
              <li
                className="flex items-center gap-2 rounded-md border-[1.5px] border-dashed border-border-strong bg-sunken py-1.25 pr-2.5 pl-1.25"
                key={`${o.fromFolderId}:${o.userId}`}
                title={`Inherited from ${o.fromFolderName}`}
              >
                <Avatar name={o.name} size={28} tone="ok" />
                <b className="text-[0.875rem] font-bold">{o.name}</b>
                <span className="text-small text-muted">from {o.fromFolderName} · locked</span>
              </li>
            ))}
            {!readOnly && (
              <li>
                <SubjectPicker
                  exclude={[
                    ...owners.map((id) => ({ id, kind: "user" as const, name: id })),
                    ...inheritedOwners.map((o) => ({
                      id: o.userId,
                      kind: "user" as const,
                      name: o.name,
                    })),
                  ]}
                  label="Add owner"
                  onPick={(s) => {
                    if (!s.id) return;
                    setKnown((k) => ({ ...k, [s.id as string]: s.name }));
                    change({ ...draft, owners: [...owners, s.id] });
                  }}
                  options={subjectOptions.filter((s) => s.kind === "user")}
                  placeholder="Search people"
                  search={searchPeople}
                  variant="ghost"
                />
              </li>
            )}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          className="[&>button]:whitespace-nowrap"
          label="View"
          onChange={setView}
          options={[
            { label: "Simple", value: "simple" },
            { label: "Advanced (RACI grid)", value: "advanced" },
          ]}
          value={view}
        />
        {everyoneLocked && <span className="text-small text-muted">{EVERYONE_NOTE}</span>}
      </div>

      {view === "simple" ? (
        <>
          <Card className="min-w-0 overflow-hidden">
            <CardHeader subtitle="Tick what each person or group can do." title="Share with" />
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell className="px-6">Person or group</TableHeaderCell>
                  {SIMPLE_ORDER.map((k) => (
                    <TableHeaderCell className="w-27 text-center" key={k}>
                      {LABEL[k]}
                    </TableHeaderCell>
                  ))}
                  <TableHeaderCell className="relative w-13">
                    <span className="sr-only">Remove</span>
                  </TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {draft.rules.map((r, index) => {
                  const name = nameOf(r.subject);
                  const lock = locked(r);
                  return (
                    <TableRow
                      className="hover:bg-transparent"
                      key={`${r.subject.kind}:${r.subject.id ?? ""}`}
                    >
                      <TableCell className="px-6">
                        <SubjectCell name={name} subject={r.subject} />
                      </TableCell>
                      {SIMPLE_ORDER.map((k) => (
                        <TableCell className="text-center" key={k}>
                          {r.grants[k] === "deny" ? (
                            <span
                              className="inline-block rounded-[6px] border-[1.5px] border-danger px-1.5 py-1 text-small leading-[1.2] font-bold text-danger"
                              title="Denied by a rule in Advanced view"
                            >
                              Denied in Advanced
                            </span>
                          ) : (
                            <Checkbox
                              aria-label={`${name}: ${LABEL[k]}`}
                              checked={r.grants[k] === "allow"}
                              className="size-7 rounded-[7px]"
                              disabled={lock}
                              onCheckedChange={(on) =>
                                setRules(
                                  setGrant(
                                    draft.rules,
                                    index,
                                    k,
                                    on === true ? "allow" : undefined,
                                  ),
                                )
                              }
                            />
                          )}
                        </TableCell>
                      ))}
                      <TableCell>
                        {!lock && (
                          <Button
                            aria-label={`Remove ${name}`}
                            onClick={() => setRules(removeRule(draft.rules, index))}
                            size="icon-sm"
                            variant="ghost"
                          >
                            <X aria-hidden />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {draft.rules.length === 0 && (
              <p className="m-0 border-t border-border px-6 py-4 text-body text-muted">
                Not shared with anyone here yet
                {inherited.length > 0 ? " beyond what's inherited" : ""}.
              </p>
            )}
            {!readOnly && (
              <div className="border-t border-border px-6 py-3.5">
                {picker("Add person or group")}
              </div>
            )}
          </Card>
          {byFolder(inherited).map((g) => (
            <section
              aria-labelledby={`${inheritedHeading}-${g.id}`}
              className="flex flex-col gap-2.5 rounded-xl border-[1.5px] border-dashed border-border-strong bg-sunken px-6 py-4.5"
              key={g.id}
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <h2
                  className="m-0 font-display text-[1.125rem] leading-none font-bold"
                  id={`${inheritedHeading}-${g.id}`}
                >
                  Inherited from {g.name}
                </h2>
                <span className="text-[0.875rem] text-muted">
                  Read-only here. Change it on {g.name}.
                </span>
              </div>
              {g.rules.map((r) => {
                const allowed = RACI_ACTIONS.filter((a) => r.grants[a.key] === "allow").map(
                  (a) => a.label,
                );
                const denied = RACI_ACTIONS.filter((a) => r.grants[a.key] === "deny").map(
                  (a) => a.label,
                );
                return (
                  <div
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body"
                    key={`${r.subject.kind}:${r.subject.id ?? ""}`}
                  >
                    <b className="w-55 font-bold">{nameOf(r.subject)}</b>
                    {allowed.length > 0 && <span className="text-muted">{allowed.join(", ")}</span>}
                    {allowed.length > 0 && <span className="text-muted">· allowed</span>}
                    {denied.length > 0 && (
                      <span className="text-danger">Denied: {denied.join(", ")}</span>
                    )}
                  </div>
                );
              })}
            </section>
          ))}
        </>
      ) : (
        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4.5">
            <div className="flex flex-col gap-1.5">
              <h2 className="m-0 font-display text-[1.25rem] leading-none font-bold">Rules</h2>
              <span className="text-[0.875rem] text-muted">
                Checked top to bottom, then up the folder chain. For each action, the first rule
                with an answer wins. Blank falls through.
              </span>
            </div>
            <div className="ml-auto">
              <Legend />
            </div>
          </div>
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell className="w-11 pl-6">#</TableHeaderCell>
                <TableHeaderCell>Subject</TableHeaderCell>
                {RACI_ACTIONS.map((a) => (
                  <TableHeaderCell className="w-24 text-center" key={a.key}>
                    {a.key}
                    <br />
                    {a.label}
                  </TableHeaderCell>
                ))}
                <TableHeaderCell className="relative w-33 pr-6">
                  <span className="sr-only">Order</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {[
                ...draft.rules.map((r, index) => ({ i: index, inh: undefined, r })),
                ...inherited.map((r) => ({ i: -1, inh: r, r: r as RulesetRule })),
              ].map(({ i, inh, r }, row) => {
                const n = row + 1;
                const name = nameOf(r.subject);
                const lock = !!inh || locked(r);
                return (
                  <TableRow
                    className={cn("hover:bg-transparent", inh && "bg-sunken hover:bg-sunken")}
                    key={
                      inh
                        ? `inh:${inh.fromFolderId}:${r.subject.kind}:${r.subject.id ?? ""}`
                        : `own:${r.subject.kind}:${r.subject.id ?? ""}`
                    }
                    title={inh ? `Inherited from ${inh.fromFolderName}` : undefined}
                  >
                    <TableCell className="pl-6 font-mono font-bold text-muted">{n}</TableCell>
                    <TableCell>
                      <SubjectCell name={name} subject={r.subject} />
                    </TableCell>
                    {RACI_ACTIONS.map((a) => {
                      const v = r.grants[a.key];
                      const look = cellLook(v, !!inh);
                      return (
                        <TableCell className="text-center" key={a.key}>
                          <button
                            aria-label={`Rule ${n}, ${name}, ${a.label}: ${v ?? "blank"}${inh ? ", inherited, locked" : ""}`}
                            className={cn(
                              "relative mx-auto flex size-10 items-center justify-center text-[1.0625rem] font-bold disabled:cursor-default",
                              look.className,
                            )}
                            disabled={lock}
                            onClick={() => setRules(cycleGrant(draft.rules, i, a.key))}
                            type="button"
                          >
                            {look.mark}
                            {inh && (
                              <Lock
                                aria-hidden
                                className="absolute -right-1.5 -bottom-1.5 size-3.5 rounded-[4px] bg-surface p-px text-muted"
                              />
                            )}
                          </button>
                        </TableCell>
                      );
                    })}
                    <TableCell className="pr-6">
                      {inh ? (
                        <span className="ml-auto block max-w-28 text-right text-small leading-[1.3] font-bold text-muted">
                          {`Inherited from ${inh.fromFolderName}`}
                        </span>
                      ) : (
                        !readOnly && (
                          <span className="flex justify-end gap-1">
                            <Button
                              aria-label={`Move rule ${n} up`}
                              disabled={i === 0}
                              onClick={() => setRules(moveRule(draft.rules, i, -1))}
                              size="icon-sm"
                              variant="secondary"
                            >
                              <ArrowUp aria-hidden />
                            </Button>
                            <Button
                              aria-label={`Move rule ${n} down`}
                              disabled={i === draft.rules.length - 1}
                              onClick={() => setRules(moveRule(draft.rules, i, 1))}
                              size="icon-sm"
                              variant="secondary"
                            >
                              <ArrowDown aria-hidden />
                            </Button>
                            {!lock && (
                              <Button
                                aria-label={`Delete rule ${n}`}
                                className="text-danger"
                                onClick={() => setRules(removeRule(draft.rules, i))}
                                size="icon-sm"
                                variant="ghost"
                              >
                                <X aria-hidden />
                              </Button>
                            )}
                          </span>
                        )
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-3 border-t border-border px-6 py-3.5">
              {picker("Add rule")}
              <span className="text-small text-muted">
                New rules go to the bottom of this {scope === "folder" ? "folder" : "secret"}&apos;s
                list, above inherited ones.
              </span>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
