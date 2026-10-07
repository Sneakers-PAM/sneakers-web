import { edge } from "@/lib/edge.live";
import { OsadminError } from "@/lib/osadmin/errors";
import { setCodeCsrfToken, setSession } from "@/lib/osadmin/sessionStore";

// A stand-in for the browser's XMLHttpRequest: records what the edge sends and lets each
// test play the server's answer.
class FakeRequest {
  static last: FakeRequest;
  body: unknown;
  headers: Record<string, string> = {};
  method = "";
  responseText = "";
  status = 0;
  target = "";
  readonly upload = new EventTarget();
  withCredentials = false;
  private readonly events = new EventTarget();

  constructor() {
    FakeRequest.last = this;
  }

  addEventListener(type: string, listener: () => void) {
    this.events.addEventListener(type, listener);
  }

  answer(status: number, text: string) {
    this.status = status;
    this.responseText = text;
    this.events.dispatchEvent(new Event("load"));
  }

  open(method: string, target: string) {
    this.method = method;
    this.target = target;
  }

  progress(loaded: number, total: number) {
    this.upload.dispatchEvent(
      Object.assign(new Event("progress"), { lengthComputable: true, loaded, total }),
    );
  }

  send(body: unknown) {
    this.body = body;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
}

describe("live edge upload", () => {
  beforeEach(() => vi.stubGlobal("XMLHttpRequest", FakeRequest));
  afterEach(() => vi.unstubAllGlobals());

  it("posts the raw file with the CSRF header and reports progress", async () => {
    const csrfToken = ["csrf", String(Date.now())].join("-");
    setSession({ admin: "alice", csrfToken, role: "ROLE_OWNER" });
    const file = new Blob(["bin"]);
    const seen: number[] = [];
    const pending = edge.upload(file, (fraction) => seen.push(fraction));
    const request = FakeRequest.last;
    expect(request.method).toBe("POST");
    expect(request.target).toBe("/upload");
    expect(request.headers["X-CSRF-Token"]).toBe(csrfToken);
    expect(request.body).toBe(file);
    request.progress(1, 4);
    request.answer(200, JSON.stringify({ uploadId: "u1" }));
    await expect(pending).resolves.toEqual({ uploadId: "u1" });
    expect(seen).toEqual([0.25, 1]);
  });

  it("turns a plain-text refusal into an error naming its symbol", async () => {
    const pending = edge.upload(new Blob(["bin"]));
    FakeRequest.last.answer(400, "UPGRADE_UPLOAD: the file is too large\n");
    const error = await pending.catch((error_: unknown) => error_);
    expect(error).toBeInstanceOf(OsadminError);
    expect(error).toMatchObject({ code: "invalid_argument", symbol: "UPGRADE_UPLOAD" });
  });
});

describe("live edge request", () => {
  const sent: Headers[] = [];
  beforeEach(() => {
    sent.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: RequestInit) => {
        sent.push(new Headers(init.headers));
        return Promise.resolve(new Response("{}", { status: 200 }));
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("sends a redeemed code's CSRF token until there's a session, then the session's", async () => {
    setCodeCsrfToken("code-csrf");
    await edge.request("SetupService", "BeginCredentials", {});
    expect(sent[0]?.get("X-CSRF-Token")).toBe("code-csrf");
    setSession({ admin: "alice", csrfToken: "session-csrf", role: "ROLE_OWNER" });
    await edge.request("SetupService", "GetSetup", {});
    expect(sent[1]?.get("X-CSRF-Token")).toBe("session-csrf");
    setSession(null);
    await edge.request("SignInService", "SignIn", {});
    expect(sent[2]?.get("X-CSRF-Token")).toBeNull();
  });
});
