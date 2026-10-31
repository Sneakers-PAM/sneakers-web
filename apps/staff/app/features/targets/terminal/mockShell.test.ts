import type { SessionEvents } from "@/features/targets/terminal/session";

import { openMockShell } from "@/features/targets/terminal/mockShell";

const ticket = {
  expiresInSeconds: 30,
  sessionId: "mock-ssh-session-1",
  ticket: "mock-ticket-1",
  wsUrl: "mock-ssh://mock-gateway.example.invalid/ssh/session",
};

const plain = (s: string) => s.replaceAll(/\u001B\[[0-9;]*[A-Za-z]/g, "");

const run = async (pinned = true) => {
  let out = "";
  const closed: unknown[] = [];
  let opened = 0;
  const events: SessionEvents = {
    onClose: (r) => closed.push(r),
    onOpen: () => opened++,
    onOutput: (d) => {
      out += typeof d === "string" ? d : new TextDecoder().decode(d);
    },
  };
  const session = await openMockShell(
    ticket,
    { hostname: "build1.example.org", pinned, username: "deploy" },
    events,
  );
  await Promise.resolve();
  return {
    clear: () => {
      out = "";
    },
    closed,
    opened: () => opened,
    output: () => plain(out),
    raw: () => out,
    session,
    type: (s: string) => session.send(s),
  };
};

const up = (rows: number) => `\u001B[${rows}A`;
// The prompt is 17 cells, so a third letter fills the first row of 20.
const narrow = async (typed: string) => {
  const shell = await run();
  shell.session.resize(20, 24);
  shell.type(typed);
  shell.clear();
  return shell;
};

describe("the mock SSH session", () => {
  it("says plainly that it's a mock and opens on a prompt, without a network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const shell = await run();
    expect(shell.opened()).toBe(1);
    expect(shell.output()).toContain("MOCK SESSION");
    expect(shell.output()).toContain("nothing you type leaves this page");
    expect(shell.output()).toMatch(/deploy@build1:~\$ $/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("runs a few commands, edits the line, and interrupts with Ctrl-C", async () => {
    const shell = await run();
    shell.type("whoamx\u007Fi\r");
    expect(shell.output()).toContain("whoamx\b \bi\r\ndeploy\r\n");
    shell.type("hostname\r");
    expect(shell.output()).toContain("build1.example.org");
    shell.type("rm -rf /\r");
    expect(shell.output()).toContain("rm: command not found in the mock shell");
    shell.type("sleep 100\u0003");
    expect(shell.output()).toContain("sleep 100^C");
  });

  describe("a line that wraps", () => {
    const DEL = "\u007F";
    const PROMPT = "deploy@build1:~$ ";

    it("rubs out one cell in the middle of a row", async () => {
      const shell = await narrow("ab");
      shell.type(DEL);
      expect(shell.raw()).toBe("\b \b");
    });

    it("redraws from a full row, where the cursor can't step back", async () => {
      const shell = await narrow("abc");
      shell.type(DEL);
      expect(shell.output()).toBe(`\r${PROMPT}ab`);
      expect(shell.raw()).not.toContain(up(1));
    });

    it("goes back up a row when a delete crosses the wrap", async () => {
      const shell = await narrow("abcd");
      shell.type(DEL);
      expect(shell.output()).toBe(`\r${PROMPT}abc`);
      expect(shell.raw()).toContain(up(1));
    });

    it("climbs every row of a longer line", async () => {
      const shell = await narrow("a".repeat(24));
      shell.type(DEL);
      expect(shell.output()).toBe(`\r${PROMPT}${"a".repeat(23)}`);
      expect(shell.raw()).toContain(up(2));
    });

    it("runs the line it shows after editing across the wrap", async () => {
      const shell = await narrow("whoamixxxx");
      shell.type(`${DEL.repeat(4)}\r`);
      expect(shell.output()).toContain("deploy\r\n");
    });
  });

  it("ends the session on exit", async () => {
    const shell = await run();
    shell.type("exit\r");
    expect(shell.output()).toContain("logout");
    expect(shell.closed).toEqual([{ kind: "ended" }]);
  });

  it("refuses an unpinned host the way the broker does", async () => {
    const shell = await run(false);
    expect(shell.closed).toEqual([{ kind: "host-key-not-pinned" }]);
  });
});
