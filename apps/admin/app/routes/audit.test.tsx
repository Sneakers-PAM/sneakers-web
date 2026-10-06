import { tamperAuditRecord } from "@sneakers-web/mock-gateway";
import { appRequest, sessionCookie, withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as audit from "@/routes/audit";
import { loader as exportLoader } from "@/routes/audit.export";
import { renderAdmin } from "@/test/stub";

withMockGateway();

const ROUTES = [{ module: audit, path: "/audit" }];

const exported = async (query: string) => {
  const request = appRequest(`/audit/export?${query}`, {
    cookie: sessionCookie("mock-user-alice"),
  });
  return (await exportLoader({ context: {}, params: {}, request } as never)) as Response;
};

describe("the audit trail", () => {
  it("shows a verified chain and the newest records first, with tier and sensitivity", async () => {
    renderAdmin(ROUTES, "/audit");
    expect(await screen.findByText(/Chain verified · 26 records/)).toBeInTheDocument();
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("#1205");
    expect(rows[0]).toHaveTextContent("Break-glass reveal");
    expect(within(rows[0] as HTMLElement).getByText("sensitive")).toBeInTheDocument();
    expect(screen.getByText("Showing 25 of 26 records")).toBeInTheDocument();
  });

  it("links the actor to their user record, but not a system actor", async () => {
    renderAdmin(ROUTES, "/audit?show=all");
    await screen.findByText(/Chain verified/);
    const rows = screen.getAllByRole("row").slice(1);
    const aliceRow = rows.find((r) => r.textContent?.includes("#1205")) as HTMLElement;
    expect(within(aliceRow).getByRole("link", { name: "Alice" })).toHaveAttribute(
      "href",
      "/users/mock-user-alice",
    );
    const systemRow = rows.find((r) => r.textContent?.includes("#1203")) as HTMLElement;
    expect(within(systemRow).queryByRole("link", { name: "system" })).not.toBeInTheDocument();
  });

  it("filters by actor name", async () => {
    renderAdmin(ROUTES, "/audit?actor=Bob&show=all");
    expect(await screen.findByText(/Showing 5 of 26/)).toBeInTheDocument();
    for (const row of screen.getAllByRole("row").slice(1)) expect(row).toHaveTextContent("Bob");
  });

  it("filters by time", async () => {
    renderAdmin(ROUTES, "/audit?when=24h&show=all");
    expect(await screen.findByText(/Showing 15 of 26/)).toBeInTheDocument();
  });

  it("filters by subject with an action hidden", async () => {
    renderAdmin(ROUTES, "/audit?subject=payroll&hide=request.create&show=all");
    expect(await screen.findByText(/Showing 3 of 26/)).toBeInTheDocument();
  });

  it("opens a record in the sheet with its attributes and hashes", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/audit");
    await user.click(await screen.findByRole("link", { name: "Open record 1197" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("web-01 deploy key")).toBeInTheDocument();
    expect(within(sheet).getByText("Firefox 131 · macOS")).toBeInTheDocument();
    expect(within(sheet).getByText(/^prev/)).toBeInTheDocument();
  });

  it("shows a secret edit's field changes without any value of a sensitive field", async () => {
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/audit?show=all");
    await user.click(await screen.findByRole("link", { name: "Open record 1188" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText("deployer")).toBeInTheDocument();
    expect(within(sheet).getByText("privateKey")).toBeInTheDocument();
    expect(within(sheet).getByText("value hidden")).toBeInTheDocument();
  });

  it("flags a broken chain, the bad row and its hash", async () => {
    tamperAuditRecord(1197);
    const user = userEvent.setup();
    renderAdmin(ROUTES, "/audit");
    expect(await screen.findByRole("alert")).toHaveTextContent("Chain broken at #1197");
    await user.click(screen.getByRole("link", { name: "Open #1197" }));
    const sheet = await screen.findByRole("dialog");
    expect(within(sheet).getByText(/hash doesn.t match/)).toBeInTheDocument();
  });

  it("refuses someone who isn't a site admin", async () => {
    renderAdmin(ROUTES, "/audit", "mock-user-bob");
    expect(await screen.findByText("Only a site admin can do that.")).toBeInTheDocument();
  });
});

describe("audit export", () => {
  it("downloads the filtered records as CSV", async () => {
    const r = await exported("format=csv&actor=Bob&show=all");
    expect(r.headers.get("Content-Type")).toMatch(/text\/csv/);
    expect(r.headers.get("Content-Disposition")).toMatch(
      /attachment; filename="sneakers-audit-.*\.csv"/,
    );
    const text = await r.text();
    const lines = text.split("\r\n");
    expect(lines[0]).toBe(
      "seq,occurredAt,tier,action,actorUserId,actorName,subject,groupId,sensitive,attributes,prevHash,hash",
    );
    expect(lines).toHaveLength(6);
  });

  it("downloads JSON lines with the hashes", async () => {
    const r = await exported("format=jsonl&show=25");
    const text = await r.text();
    const records = text
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l) as { hash: string; seq: number });
    expect(records).toHaveLength(25);
    expect(records[0]?.seq).toBe(1205);
    expect(records[0]?.hash).toMatch(/^[0-9a-f]{64}$/);
  });
});
