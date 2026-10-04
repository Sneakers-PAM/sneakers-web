import { EdgeBanner, refusalMessage } from "@sneakers-web/shell";
import { Button, cn, toast } from "@sneakers-web/ui";
import {
  ChevronLeft,
  Circle,
  ExternalLink,
  Keyboard,
  LoaderCircle,
  Maximize,
  RefreshCw,
  X,
} from "lucide-react";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { Link, useFetcher } from "react-router";

import type { OpenResult, TerminalSession } from "@/features/targets/terminal.server";
import type { Screen } from "@/features/targets/terminal/screen";
import type { CloseReason, Session } from "@/features/targets/terminal/session";

import { TerminalDepsContext } from "@/features/targets/terminal/deps";
import { platformOf, shortcutFor } from "@/features/targets/terminal/keys";
import { closeMessage } from "@/features/targets/terminal/messages";
import { ShortcutsDialog } from "@/features/targets/terminal/ShortcutsDialog";

type Ready = Extract<TerminalSession, { kind: "ready" }>;

type Status = "closed" | "connected" | "connecting" | "error";

const DEFAULT_FONT = 15;
const MIN_FONT = 10;
const MAX_FONT = 24;
// Two Escapes this close together leave the terminal (one Escape still goes to the shell).
const DOUBLE_ESCAPE_MS = 600;

const GREY = "\u001B[90m";
const RESET = "\u001B[0m";

const STATUS: Record<Status, { className: string; icon: React.ReactNode; label: string }> = {
  closed: { className: "bg-[#262B36] text-[#9AA3B2]", icon: <Circle />, label: "Closed" },
  connected: {
    className: "bg-[#16302A] text-[#6FD39B]",
    icon: <Circle className="fill-current" />,
    label: "Connected",
  },
  connecting: {
    className: "bg-[#1D2640] text-[#8FA9FF]",
    icon: <LoaderCircle className="animate-spin motion-reduce:animate-none" />,
    label: "Connecting…",
  },
  error: { className: "bg-[#3A1F22] text-[#FF8577]", icon: <X />, label: "Error" },
};

// The terminal's own dark chrome; the kit's secondary button is drawn for light surfaces.
const TOOL =
  "h-8.5 border-[#3A4252] bg-transparent px-3 text-[0.875rem] text-[#E6E9EF] hover:border-[#5A6170] hover:bg-white/5 active:bg-white/10";

interface Problem {
  message: string;
  title: string;
}

/** U-12: a live SSH session over the broker, full screen, outside the frame. */
export const Console = ({
  secret,
  session,
}: {
  secret: { id: string; name: string };
  session: Ready;
}) => {
  const deps = use(TerminalDepsContext);
  const fetcher = useFetcher<OpenResult>();
  const rootRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLAnchorElement>(null);
  const screenRef = useRef<null | Screen>(null);
  const sessionRef = useRef<null | Session>(null);
  // The attempt whose events still count; a reconnect or unmount retires the old one.
  const attemptRef = useRef<null | symbol>(null);
  const handled = useRef<unknown>(null);
  const keysRef = useRef<(event: KeyboardEvent) => boolean>(() => true);
  const [status, setStatus] = useState<Status>("connecting");
  const [sessionProblem, setProblem] = useState<null | Problem>(null);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT);
  const [shortcuts, setShortcuts] = useState(false);
  const [ready, setReady] = useState(false);
  const [platform] = useState(() => platformOf(globalThis.navigator.userAgent));
  const submit = fetcher.submit;
  const label = session.username ? `${session.username}@${session.hostname}` : session.hostname;

  const open = useCallback(() => {
    attemptRef.current = null;
    sessionRef.current?.close();
    sessionRef.current = null;
    setStatus("connecting");
    setProblem(null);
    const screen = screenRef.current;
    screen?.reset();
    screen?.write(`${GREY}Opening session to ${session.hostname} with the stored key…${RESET}\r\n`);
    void submit({ intent: "open" }, { method: "post" });
  }, [session.hostname, submit]);

  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let gone = false;
    let made: Screen | undefined;
    void deps.createScreen(mount, { fontSize: DEFAULT_FONT }).then((screen) => {
      if (gone) {
        screen.dispose();
        return;
      }
      made = screen;
      screenRef.current = screen;
      screen.onInput((data) => sessionRef.current?.send(data));
      screen.onResize((cols, rows) => sessionRef.current?.resize(cols, rows));
      screen.onKey((event) => keysRef.current(event));
      setReady(true);
    });
    return () => {
      gone = true;
      attemptRef.current = null;
      sessionRef.current?.close();
      sessionRef.current = null;
      made?.dispose();
      screenRef.current = null;
    };
  }, [deps]);

  useEffect(() => {
    if (ready) openRef.current();
  }, [ready]);

  useEffect(() => {
    const result = fetcher.data;
    if (!result || handled.current === result) return;
    handled.current = result;
    if (!result.ok) return;
    const attempt = Symbol("attempt");
    attemptRef.current = attempt;
    const live = () => attemptRef.current === attempt;
    const sizeUp = () => {
      const screen = screenRef.current;
      if (screen) sessionRef.current?.resize(screen.size().cols, screen.size().rows);
    };
    void deps
      .connect(result.ticket, session, {
        onClose: (reason: CloseReason) => {
          if (!live()) return;
          sessionRef.current = null;
          attemptRef.current = null;
          if (reason.kind === "ended") {
            setStatus("closed");
            setProblem({ message: "The shell ended the session.", title: "Session closed" });
            return;
          }
          setStatus("error");
          setProblem({ message: closeMessage(reason), title: "Connection error" });
        },
        onOpen: () => {
          if (!live()) return;
          screenRef.current?.reset();
          screenRef.current?.fit();
          screenRef.current?.focus();
          sizeUp();
          setStatus("connected");
        },
        onOutput: (data) => {
          if (live()) screenRef.current?.write(data);
        },
      })
      .then((opened) => {
        if (!live()) {
          opened.close();
          return;
        }
        sessionRef.current = opened;
        sizeUp();
      });
  }, [deps, fetcher.data, session]);

  useEffect(() => {
    screenRef.current?.setFontSize(fontSize);
  }, [fontSize]);

  const bigger = () => setFontSize((s) => Math.min(MAX_FONT, s + 1));
  const smaller = () => setFontSize((s) => Math.max(MIN_FONT, s - 1));
  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen();
  };
  const copy = () => {
    const text = screenRef.current?.selection() ?? "";
    if (!text) return;
    void navigator.clipboard
      .writeText(text)
      .then(() => toast("Copied the selection."))
      .catch(() => toast.error("Couldn't copy. Use your browser's copy instead."));
  };

  const lastEscape = useRef(0);
  useEffect(() => {
    keysRef.current = (event) => {
      const shortcut = shortcutFor(event, platform);
      if (!shortcut) {
        if (event.type === "keydown" && event.key === "Escape") {
          if (event.timeStamp - lastEscape.current < DOUBLE_ESCAPE_MS) {
            screenRef.current?.blur();
            backRef.current?.focus();
          }
          lastEscape.current = event.timeStamp;
        }
        return true;
      }
      if (shortcut === "copy" && !screenRef.current?.selection()) return true;
      if (event.type !== "keydown") return false;
      event.preventDefault();
      const run = { bigger, copy, fullscreen, reconnect: open, smaller }[shortcut];
      run();
      return false;
    };
  });

  // A refused ticket is shown straight from the action's answer, until the next attempt.
  const refused =
    fetcher.state === "idle" && fetcher.data && !fetcher.data.ok ? fetcher.data.refusal : null;
  const shownStatus: Status = refused ? "error" : status;
  const problem = refused
    ? { message: refusalMessage(refused), title: "Connection error" }
    : sessionProblem;
  const s = STATUS[shownStatus];
  return (
    <div className="flex h-dvh flex-col bg-[#0E1117] text-[#E6E9EF]" ref={rootRef}>
      <EdgeBanner />
      <header className="flex min-h-14 flex-wrap items-center gap-3 border-b border-[#2A3140] bg-[#161A22] px-4 py-2.5">
        <Button asChild className={cn(TOOL, "h-9")} size="sm" variant="secondary">
          <Link ref={backRef} to={`/secret/${secret.id}`}>
            <ChevronLeft aria-hidden />
            Back
          </Link>
        </Button>
        <div className="flex min-w-0 flex-col gap-1">
          <b className="truncate text-[0.9375rem] leading-none">{secret.name}</b>
          <span className="truncate font-mono text-[0.75rem] leading-none text-[#9AA3B2]">
            {label}
          </span>
        </div>
        <span
          aria-live="polite"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[0.75rem] leading-none font-bold whitespace-nowrap [&_svg]:size-2.5",
            s.className,
          )}
        >
          <span aria-hidden className="contents">
            {s.icon}
          </span>
          {s.label}
        </span>
        <div className="ml-auto flex flex-wrap gap-1.5">
          <Button
            aria-label="Smaller text"
            className={TOOL}
            disabled={fontSize <= MIN_FONT}
            onClick={smaller}
            size="sm"
            variant="secondary"
          >
            A−
          </Button>
          <Button
            aria-label="Bigger text"
            className={TOOL}
            disabled={fontSize >= MAX_FONT}
            onClick={bigger}
            size="sm"
            variant="secondary"
          >
            A+
          </Button>
          <Tool icon={<Keyboard />} label="Shortcuts" onClick={() => setShortcuts(true)} />
          <Tool icon={<RefreshCw />} label="Reconnect" onClick={open} />
          <Tool
            icon={<ExternalLink />}
            label="New window"
            onClick={() => window.open(globalThis.location.href, "_blank", "noopener")}
          />
          <Tool icon={<Maximize />} label="Fullscreen" onClick={fullscreen} />
        </div>
      </header>
      <div className="relative min-h-0 flex-1 px-5 py-4">
        <div className="size-full" ref={mountRef} />
        {problem && (
          <div
            className={cn(
              "absolute bottom-5 left-5 flex max-w-[520px] flex-col gap-3 rounded-[14px] border-[1.5px] bg-[#1A1F29] p-4.5",
              shownStatus === "error" ? "border-[#FF8577]" : "border-[#3A4252]",
            )}
            role={shownStatus === "error" ? "alert" : "status"}
          >
            <b
              className={cn(
                "font-display text-[1.0625rem] leading-[1.2]",
                shownStatus === "error" && "text-[#FF8577]",
              )}
            >
              {problem.title}
            </b>
            <span className="text-[0.9375rem] leading-[1.45]">{problem.message}</span>
            <span className="flex flex-wrap gap-2">
              <Button
                className="bg-[#8FA9FF] text-[#0E1117] hover:bg-[#B3C4FF]"
                onClick={open}
                size="sm"
              >
                <RefreshCw aria-hidden />
                Reconnect
              </Button>
              <Button asChild className={TOOL} size="sm" variant="secondary">
                <Link to={`/secret/${secret.id}`}>Back to secret</Link>
              </Button>
            </span>
          </div>
        )}
      </div>
      <ShortcutsDialog onOpenChange={setShortcuts} open={shortcuts} platform={platform} />
    </div>
  );
};

const Tool = ({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) => (
  <Button aria-label={label} className={TOOL} onClick={onClick} size="sm" variant="secondary">
    <span aria-hidden className="contents">
      {icon}
    </span>
    <span className="hidden tablet:inline">{label}</span>
  </Button>
);
