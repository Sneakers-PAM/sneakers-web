import type { Connect } from "@/features/targets/terminal/session";

/*
 * A pretend shell for mock builds only (the terminal loads it behind the build's mock flag, so
 * a live bundle drops it). It runs in the page: no socket, no request, nothing typed goes
 * anywhere. It speaks the same Session interface as the live socket, so the page can't tell.
 */

const ESC = "\u001B";
const YELLOW = `${ESC}[33m`;
const GREEN = `${ESC}[32m`;
const BLUE = `${ESC}[34m`;
const DIM = `${ESC}[2m`;
const RESET = `${ESC}[0m`;
const DEL = "\u007F";
const BACKSPACE = "\b";
const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
// An escape sequence (arrows, Home, End): consumed, never echoed as text.

const SEQUENCE = /^\u001B(\[[0-9;]*[A-Za-z~]|O[A-Za-z])?/;

export const openMockShell: Connect = (_ticket, info, events) => {
  const short = info.hostname.split(".", 1)[0] ?? info.hostname;
  const user = info.username || "user";
  const prompt = `${GREEN}${user}@${short}${RESET}:${BLUE}~${RESET}$ `;
  let line = "";
  let closed = false;

  const out = (text: string) => events.onOutput(text);
  const end = (reason: Parameters<typeof events.onClose>[0]) => {
    closed = true;
    events.onClose(reason);
  };

  const commands: Record<string, (arguments_: string[]) => string> = {
    date: () => new Date().toUTCString(),
    echo: (arguments_) => arguments_.join(" "),
    help: () => "Commands: whoami, hostname, pwd, ls, date, uname, echo, clear, exit",
    hostname: () => info.hostname,
    ls: () => "notes.txt  releases  scripts",
    pwd: () => `/home/${user}`,
    uname: () => "Linux (mock)",
    whoami: () => user,
  };

  const run = (input: string) => {
    const [name = "", ...arguments_] = input.trim().split(/\s+/);
    if (!name) return;
    if (name === "exit" || name === "logout") {
      out("logout\r\n");
      end({ kind: "ended" });
      return;
    }
    if (name === "clear") {
      out(`${ESC}[2J${ESC}[H`);
      return;
    }
    const command = commands[name];
    out(`${command ? command(arguments_) : `${name}: command not found in the mock shell`}\r\n`);
  };

  const send = (input: string) => {
    let rest = input;
    while (rest && !closed) {
      const ch = rest.charAt(0);
      if (ch === ESC) {
        rest = rest.slice(SEQUENCE.exec(rest)?.[0].length ?? 1);
        continue;
      }
      rest = rest.slice(1);
      switch (ch) {
        case "\r":
        case "\n": {
          out("\r\n");
          run(line);
          line = "";
          if (!closed) out(prompt);

          break;
        }
        case BACKSPACE:
        case DEL: {
          if (line) {
            line = line.slice(0, -1);
            out("\b \b");
          }

          break;
        }
        case CTRL_C: {
          line = "";
          out(`^C\r\n${prompt}`);

          break;
        }
        default: {
          if (ch === CTRL_D && !line) {
            out("\r\n");
            run("exit");
          } else if (ch >= " ") {
            line += ch;
            out(ch);
          }
        }
      }
    }
  };

  queueMicrotask(() => {
    events.onOpen();
    out(
      `${YELLOW}MOCK SESSION: no real host is connected, and nothing you type leaves this page.${RESET}\r\n`,
    );
    if (!info.pinned) {
      end({ kind: "host-key-not-pinned" });
      return;
    }
    out(`${DIM}A pretend shell as ${user}@${info.hostname}. Type help.${RESET}\r\n\r\n${prompt}`);
  });

  return Promise.resolve({
    close: () => {
      closed = true;
    },
    resize: () => {},
    send,
  });
};
