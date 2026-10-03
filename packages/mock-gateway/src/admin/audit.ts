import { AdminAuditDocument } from "@sneakers-web/api-client";
import { HttpResponse } from "msw";

import { groups } from "#mock/admin/directory";
import { isSiteAdmin, notSiteAdmin } from "#mock/admin/refuse";
import { USERS } from "#mock/fixtures/users";
import { api, asUser } from "#mock/handlers/graphql";
import { onMockReset } from "#mock/state";

type Entry = [
  minutesAgo: number,
  action: string,
  actor: string,
  subject: string,
  tier: "activity" | "audit",
  sensitive?: boolean,
  attributes?: Record<string, string>,
];

interface MockAuditRecord {
  action: string;
  actorName: string;
  actorUserId: string;
  attributes: { key: string; value: string }[];
  groupId: string;
  hash: string;
  occurredAt: string;
  prevHash: string;
  sensitive: boolean;
  seq: number;
  subject: string;
  tier: "activity" | "audit";
}

const ALICE = "mock-user-alice";
const BOB = "mock-user-bob";
const CAROL = "mock-user-carol";
const DAVE = "mock-user-dave";
const SYSTEM = "system";
const CI = "mock-sa-ci";

const DAY = 24 * 60;

/** The story the trail tells, oldest first so seq and time agree. Every name and address is invented. */
const ENTRIES: Entry[] = [
  [40 * DAY, "user.create", CAROL, "Dave", "audit"],
  [39 * DAY, "group.member.add", CAROL, "Dave", "audit", false, { group: "DB team" }],
  [33 * DAY, "secret.create", BOB, "DB admin", "audit"],
  [
    26 * DAY,
    "role.recovery.grant",
    CAROL,
    "Alice",
    "audit",
    false,
    { role: "recovery", severity: "high" },
  ],
  [20 * DAY, "folder.ruleset.set", CAROL, "Platform / Databases", "audit"],
  [
    12 * DAY,
    "secret.rotation.failed",
    SYSTEM,
    "Payroll portal",
    "audit",
    false,
    { error: "target unreachable" },
  ],
  [
    9 * DAY,
    "secret.version.reveal",
    ALICE,
    "DB admin",
    "audit",
    true,
    { field: "password", version: "3" },
  ],
  [6 * DAY, "api_token.mint", CAROL, "CI Pipeline", "audit"],
  [
    4 * DAY,
    "secret.update",
    BOB,
    "web-01 deploy key",
    "audit",
    false,
    {
      changes: JSON.stringify([{ field: "username", new: "deploy", old: "deployer" }]),
      sensitiveChanged: JSON.stringify(["privateKey"]),
    },
  ],
  [2 * DAY, "auth.signin", DAVE, "Dave", "activity", false, { ip: "192.0.2.31", outcome: "ok" }],
  [
    30 * 60,
    "secret.copy",
    ALICE,
    "Acme VPN",
    "audit",
    true,
    { field: "password", ip: "192.0.2.14" },
  ],
  [15 * 60 + 47, "secret.update", BOB, "web-01 deploy key", "audit"],
  [
    12 * 60 + 10,
    "request.create",
    DAVE,
    "Payroll portal",
    "activity",
    false,
    { reason: "Month-end close" },
  ],
  [11 * 60 + 22, "rotate.enqueue", SYSTEM, "Acme VPN", "activity"],
  [10 * 60 + 40, "user.create", CAROL, "Erin", "audit"],
  [
    9 * 60 + 58,
    "auth.signin",
    ALICE,
    "Alice",
    "activity",
    false,
    { ip: "192.0.2.14", outcome: "ok" },
  ],
  [8 * 60 + 5, "secret.heartbeat.drift", SYSTEM, "Payroll portal", "audit"],
  [
    7 * 60 + 12,
    "secret.copy",
    BOB,
    "web-01 deploy key",
    "audit",
    true,
    {
      field: "password",
      ip: "192.0.2.46",
      session: "sess_3ede2b645b69",
      user_agent: "Firefox 131 · macOS",
    },
  ],
  [6 * 60 + 20, "secret.read", DAVE, "Reporting reader", "activity"],
  [5 * 60 + 31, "api_token.use", CI, "CI deploy token", "activity"],
  [4 * 60 + 40, "folder.ruleset.set", CAROL, "Platform / Databases", "audit"],
  [3 * 60 + 55, "secret.reveal", BOB, "DB admin", "audit", true, { field: "password" }],
  [
    3 * 60 + 54,
    "secret.use.approve",
    ALICE,
    "DB admin",
    "audit",
    true,
    { client: "MCP client", command: "psql -h db1.example.org" },
  ],
  [
    2 * 60 + 58,
    "secret.rotation.failed",
    SYSTEM,
    "Payroll portal",
    "audit",
    false,
    { error: "bind refused" },
  ],
  [2 * 60 + 1, "mfa.verify", ALICE, "Alice", "audit"],
  [
    60 * 2,
    "secret.break_glass",
    ALICE,
    "DB admin",
    "audit",
    true,
    {
      ip: "192.0.2.14",
      reason: "Prod DB locked out during incident",
      rotation: "queued",
      severity: "high",
    },
  ],
];

/** A stand-in for SHA-256: 64 hex digits, stable for the same input. Mock data only. */
const fakeHash = (text: string): string => {
  let out = "";
  for (let round = 0; out.length < 64; round++) {
    let h = 2_166_136_261 ^ round; // the FNV-1a offset basis
    for (let index = 0; index < text.length; index++) {
      h ^= text.codePointAt(index) ?? 0;
      h = Math.imul(h, 16_777_619); // the FNV prime
    }
    out += (h >>> 0).toString(16).padStart(8, "0");
  }
  return out.slice(0, 64);
};

const body = (r: Omit<MockAuditRecord, "hash">) =>
  JSON.stringify([
    r.seq,
    r.prevHash,
    r.action,
    r.actorUserId,
    r.subject,
    r.occurredAt,
    r.attributes,
  ]);

const nameOf = (id: string) =>
  id === SYSTEM
    ? "system"
    : id === CI
      ? "CI Pipeline"
      : (USERS.find((u) => u.id === id)?.name ?? id);

const build = (now = Date.now()): MockAuditRecord[] => {
  const out: MockAuditRecord[] = [];
  let previousHash = "";
  for (const [
    index,
    [ago, action, actor, subject, tier, sensitive, attributes],
  ] of ENTRIES.entries()) {
    const draft = {
      action,
      actorName: nameOf(actor),
      actorUserId: actor,
      attributes: Object.entries(attributes ?? {}).map(([key, value]) => ({ key, value })),
      groupId: subject.startsWith("Platform") ? "mock-group-platform" : "",
      occurredAt: new Date(now - ago * 60_000).toISOString(),
      prevHash: previousHash,
      sensitive: !!sensitive,
      seq: 1180 + index,
      subject,
      tier,
    };
    const record = { ...draft, hash: fakeHash(body(draft)) };
    out.push(record);
    previousHash = record.hash;
  }
  return out;
};

const trail = { records: build() };

onMockReset(() => {
  trail.records = build();
});

/** Change a stored record after the fact, as tampering would: the chain breaks there. */
export const tamperAuditRecord = (seq: number): void => {
  const r = trail.records.find((x) => x.seq === seq);
  if (r) r.subject = `${r.subject} (edited)`;
};

const verify = () => {
  let previous = "";
  for (const r of trail.records) {
    const { hash, ...rest } = r;
    if (r.prevHash !== previous || fakeHash(body(rest)) !== hash) return r.seq;
    previous = hash;
  }
  return 0;
};

export const auditHandlers = [
  api.query(AdminAuditDocument, ({ request, variables }) =>
    asUser(request, (actorId) => {
      if (!isSiteAdmin(actorId)) return notSiteAdmin() as never;
      const hidden = new Set([variables.excludeActions ?? []].flat());
      const subject = variables.subject?.trim().toLowerCase();
      let rows = trail.records
        .filter((r) => !hidden.has(r.action))
        .filter((r) => !variables.actorUserId || r.actorUserId === variables.actorUserId)
        .filter((r) => !subject || r.subject.toLowerCase().includes(subject))
        .toReversed();
      if (variables.limit) rows = rows.slice(0, variables.limit);
      const broken = verify();
      return HttpResponse.json({
        data: {
          auditActions: [...new Set(trail.records.map((r) => r.action))].toSorted(),
          auditChain: { brokenAtSeq: broken, length: trail.records.length, valid: broken === 0 },
          auditRecords: rows,
          groups: groups(),
          users: USERS.map((u) => ({ id: u.id, name: u.name, username: u.username })),
        },
      } as never) as never;
    }),
  ),
];
