import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";

import { TLS_CERT_PIN_ROUTE, TlsCertPinDialog } from "#shell/targets/TlsCertPinDialog";

const LEAF = "a".repeat(64);
const CA = "b".repeat(64);
const OLD = "c".repeat(64);

const cert = (over: Record<string, unknown> = {}) => ({
  commonName: "box.example.org",
  dnsNames: ["box.example.org"],
  fingerprint: LEAF,
  ipAddresses: [],
  isCa: false,
  issuer: "CN=Example Org Issuing CA,O=Example Org",
  notAfter: "2027-06-30T00:00:00Z",
  notBefore: "2026-01-01T00:00:00Z",
  pinnable: true,
  pinned: false,
  selfSigned: false,
  serialNumber: "01",
  subject: "CN=box.example.org,O=Example Org",
  ...over,
});

const issuingCa = () =>
  cert({
    commonName: "Example Org Issuing CA",
    dnsNames: [],
    fingerprint: CA,
    isCa: true,
    pinnable: false,
    subject: "CN=Example Org Issuing CA,O=Example Org",
  });

const stub = ({
  chain = [cert(), issuingCa()],
  pinnedFingerprints = [] as string[],
  posts = [] as Record<string, string>[],
  problem,
}: {
  chain?: ReturnType<typeof cert>[];
  pinnedFingerprints?: string[];
  posts?: Record<string, string>[];
  problem?: { code: string; reason: string };
} = {}) =>
  createRoutesStub([
    {
      Component: () => (
        <TlsCertPinDialog
          hostname="box.example.org"
          onOpenChange={() => {}}
          onPinned={() => {}}
          open
          targetId="t1"
        />
      ),
      path: "/",
    },
    {
      action: async ({ request }) => {
        const form = Object.fromEntries(await request.formData()) as Record<string, string>;
        posts.push(form);
        if (problem) {
          return {
            refusal: { detail: "", metadata: {}, ...problem },
            view: "problem",
          };
        }
        if (form.intent === "pin") return { fingerprint: form.fingerprint, view: "pinned" };
        return {
          pinnedFingerprints,
          scan: {
            address: "192.0.2.10:443",
            chain,
            hostNameMatches: true,
            serverName: "box.example.org",
            systemTrustDetail: "certificate signed by unknown authority",
            systemTrusted: false,
            targetId: "t1",
            tlsVersion: "TLS 1.3",
          },
          view: "scanned",
        };
      },
      path: TLS_CERT_PIN_ROUTE,
    },
  ]);

const open = async (options?: Parameters<typeof stub>[0]) => {
  const Stub = stub(options);
  render(<Stub initialEntries={["/"]} />);
  await screen.findByText("192.0.2.10:443");
};

describe("TlsCertPinDialog", () => {
  it("scans when it opens and shows the chain with the address, version and trust notes", async () => {
    const posts: Record<string, string>[] = [];
    await open({ posts });
    expect(posts).toEqual([{ intent: "scan", targetId: "t1" }]);
    expect(screen.getByText("TLS 1.3")).toBeInTheDocument();
    expect(screen.getByText(/certificate signed by unknown authority/)).toBeInTheDocument();
    expect(screen.getByText(LEAF)).toBeInTheDocument();
    expect(screen.getByText(CA)).toBeInTheDocument();
    expect(screen.getByText("CN=box.example.org,O=Example Org")).toBeInTheDocument();
    expect(screen.getByText(/A CA certificate/)).toBeInTheDocument();
  });

  it("offers Pin only for a certificate the gateway says is pinnable", async () => {
    await open();
    expect(screen.getAllByRole("button", { name: "Pin this certificate" })).toHaveLength(1);
    const ca = screen.getByRole("group", { name: `Certificate ${CA}` });
    expect(within(ca).queryByRole("button", { name: "Pin this certificate" })).toBeNull();
    expect(within(ca).getByText(/can't be pinned on its own/)).toBeInTheDocument();
  });

  it("pins exactly the fingerprint the person saw, and never on its own", async () => {
    const posts: Record<string, string>[] = [];
    const user = userEvent.setup();
    await open({ posts });
    expect(posts.every((p) => p.intent === "scan")).toBe(true);
    await user.click(screen.getByRole("button", { name: "Pin this certificate" }));
    await vi.waitFor(() =>
      expect(posts.at(-1)).toMatchObject({ fingerprint: LEAF, intent: "pin", targetId: "t1" }),
    );
  });

  it("says a certificate is already pinned and offers no second pin", async () => {
    await open({ chain: [cert({ pinned: true }), issuingCa()], pinnedFingerprints: [LEAF] });
    expect(screen.getByText("Already pinned")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pin this certificate" })).toBeNull();
  });

  it("shows a different offered certificate beside the pinned one and pins after the hostname is typed", async () => {
    const posts: Record<string, string>[] = [];
    const user = userEvent.setup();
    await open({ pinnedFingerprints: [OLD], posts });
    const before = screen.getByRole("group", { name: "Pinned now" });
    expect(within(before).getByText(OLD)).toBeInTheDocument();
    expect(screen.getByText(/now offers a different certificate/)).toBeInTheDocument();
    const pin = screen.getByRole("button", { name: "Pin this certificate" });
    expect(pin).toBeDisabled();
    const confirm = screen.getByLabelText("Type box.example.org to confirm");
    await user.type(confirm, "box.example");
    expect(pin).toBeDisabled();
    await user.type(confirm, ".org");
    expect(pin).toBeEnabled();
    await user.click(pin);
    await vi.waitFor(() =>
      expect(posts.at(-1)).toMatchObject({ fingerprint: LEAF, intent: "pin" }),
    );
  });

  it("needs no typed confirm for a first pin", async () => {
    await open();
    expect(screen.queryByLabelText(/to confirm/)).toBeNull();
    expect(screen.getByRole("button", { name: "Pin this certificate" })).toBeEnabled();
  });

  it.each([
    ["TLS_CERT_PIN_NOT_ADMIN", /site admin/],
    ["TLS_CERT_PIN_NOT_OWNER", /owner/],
    ["TARGET_NO_TLS_CONNECTION", /no TLS connection/],
    ["CONNECTOR_UNAVAILABLE", /connector/],
  ])("says plainly why %s refused", async (reason, message) => {
    const Stub = stub({ problem: { code: "PERMISSION_DENIED", reason } });
    render(<Stub initialEntries={["/"]} />);
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pin this certificate" })).toBeNull();
  });
});
