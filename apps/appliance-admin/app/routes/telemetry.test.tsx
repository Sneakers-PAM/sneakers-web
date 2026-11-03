import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { StepUpDialog } from "@/components/StepUpDialog";
import { telemetry } from "@/lib/osadmin/client";
import { OsadminError } from "@/lib/osadmin/errors";
import { applyMockScenario, TELEMETRY_ENDPOINT } from "@/mock/edge.mock";
import { MOCK_INTERNAL_CA_PEM } from "@/mock/mirror.mock";
import Telemetry, { TELEMETRY_POLL_MS } from "@/routes/telemetry";
import { renderPage } from "@/test/renderPage";
import { signInAs } from "@/test/session";

const UNVERIFIED = /Telemetry goes to a collector that isn't checked/;

const turnOn = async (user: ReturnType<typeof userEvent.setup>, endpoint = TELEMETRY_ENDPOINT) => {
  await user.click(await screen.findByRole("switch", { name: "Export" }));
  await user.type(screen.getByLabelText("Endpoint"), endpoint);
};

/** Lets the page's next reads happen, as its poll would. */
const poll = async (times = 1) => {
  for (let index = 0; index < times; index += 1)
    await vi.advanceTimersByTimeAsync(TELEMETRY_POLL_MS);
};

describe("Telemetry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with export off, verification on, logs off, and every service off", async () => {
    renderPage(Telemetry);
    expect(await screen.findByRole("switch", { name: "Export" })).not.toBeChecked();
    expect(screen.getByLabelText("Endpoint")).toHaveValue("");
    expect(screen.getByRole("switch", { name: "Verify the certificate" })).toBeChecked();
    expect(screen.getByRole("switch", { name: "Export logs" })).not.toBeChecked();
    expect(screen.getByText("Export off")).toBeInTheDocument();
    expect(screen.queryByText(UNVERIFIED)).not.toBeInTheDocument();
    const services = within(screen.getByRole("table", { name: "Services" }));
    expect(services.getByRole("row", { name: /identity/ })).toHaveTextContent("Off");
    expect(services.getAllByRole("row")).toHaveLength(10);
  });

  it("keeps the browser and password managers out of the endpoint", async () => {
    renderPage(Telemetry);
    const field = await screen.findByLabelText("Endpoint");
    expect(field).toHaveAttribute("autocomplete", "off");
    expect(field).toHaveAttribute("data-1p-ignore");
    expect(field).toHaveAttribute("data-lpignore", "true");
    expect(field).toHaveAttribute("data-bwignore");
  });

  it("says before saving that the services restart", async () => {
    renderPage(Telemetry);
    await screen.findByRole("switch", { name: "Export" });
    expect(
      screen.getByText(/restarts the services that read these settings, phase by phase/),
    ).toBeInTheDocument();
  });

  it("saves the settings, then follows the restart phase by phase until it's done", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const set = vi.spyOn(telemetry, "set");
    renderPage(Telemetry);
    await turnOn(user);
    await user.click(screen.getByRole("switch", { name: "Export logs" }));
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    await vi.waitFor(() => expect(set).toHaveBeenCalled());
    expect(set.mock.calls[0]?.[0]).toEqual({
      settings: {
        caPem: "",
        enabled: true,
        endpoint: TELEMETRY_ENDPOINT,
        logs: true,
        skipVerify: false,
      },
    });
    const restart = await screen.findByRole("region", { name: "Restart" });
    expect(within(restart).getByText("Restarting")).toBeInTheDocument();
    expect(within(restart).getByText(/Phase core/)).toBeInTheDocument();
    await poll();
    expect(await within(restart).findByText(/Phase services/)).toBeInTheDocument();
    await poll(3);
    expect(await within(restart).findByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Exporting")).toBeInTheDocument();
    const services = within(screen.getByRole("table", { name: "Services" }));
    expect(services.getByRole("row", { name: /gateway/ })).toHaveTextContent("Sending");
  });

  it("says when a save changes nothing the services read, so nothing restarts", async () => {
    const user = userEvent.setup();
    renderPage(Telemetry);
    await user.type(await screen.findByLabelText("Endpoint"), TELEMETRY_ENDPOINT);
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    expect(await screen.findByText(/nothing the services read changed/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Restart" })).not.toBeInTheDocument();
  });

  it("shows the box's refusal of an endpoint that isn't https://, such as a bare host and port", async () => {
    const user = userEvent.setup();
    renderPage(Telemetry);
    await turnOn(user, "collector.example.org:4317");
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    expect(await screen.findByText(/isn't https:\/\/<host>\[:<port>\]/)).toBeInTheDocument();
  });

  it("shows why the collector check refused the save", async () => {
    const user = userEvent.setup();
    renderPage(Telemetry);
    await turnOn(user, "https://unreachable.example.org:4317");
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    expect(await screen.findByText(/didn't answer a TLS handshake/)).toBeInTheDocument();
  });

  it("warns while verification is off, and says logs stay on the box", async () => {
    const user = userEvent.setup();
    renderPage(Telemetry);
    await turnOn(user);
    await user.click(screen.getByRole("switch", { name: "Export logs" }));
    await user.click(screen.getByRole("switch", { name: "Verify the certificate" }));
    expect(screen.getByText(UNVERIFIED)).toBeInTheDocument();
    expect(screen.getByText(/No logs leave while verification is off/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    expect(await screen.findByText(/Logs are on but stay on the box/)).toBeInTheDocument();
  });

  it("saves a pasted collector CA and reads it back from the box", async () => {
    const user = userEvent.setup();
    const set = vi.spyOn(telemetry, "set");
    const { unmount } = renderPage(Telemetry);
    await turnOn(user);
    const ca = screen.getByLabelText("Collector CA");
    expect(ca).toHaveAttribute("autocomplete", "off");
    await user.click(ca);
    await user.paste(MOCK_INTERNAL_CA_PEM);
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    expect(await screen.findByRole("region", { name: "Restart" })).toBeInTheDocument();
    expect(set.mock.calls[0]?.[0].settings.caPem).toBe(MOCK_INTERNAL_CA_PEM);
    const answer = await telemetry.get();
    expect(answer.settings.caPem).toBe(MOCK_INTERNAL_CA_PEM);
    unmount();
    renderPage(Telemetry);
    expect(await screen.findByLabelText("Collector CA")).toHaveValue(MOCK_INTERNAL_CA_PEM);
  });

  it("takes the collector CA from a file", async () => {
    const user = userEvent.setup();
    renderPage(Telemetry);
    await user.upload(
      await screen.findByLabelText("Collector CA file"),
      new File([MOCK_INTERNAL_CA_PEM], "ca.pem"),
    );
    expect(await screen.findByLabelText("Collector CA")).toHaveValue(MOCK_INTERNAL_CA_PEM);
  });

  it("says the collector CA isn't used while verification is off", async () => {
    const user = userEvent.setup();
    renderPage(Telemetry);
    await screen.findByLabelText("Collector CA");
    expect(screen.queryByText(/The CA isn't used while verification is off/)).toBeNull();
    await user.click(screen.getByRole("switch", { name: "Verify the certificate" }));
    expect(screen.getByText(/The CA isn't used while verification is off/)).toBeInTheDocument();
  });

  it("shows the box's refusal of a collector CA that doesn't parse", async () => {
    const user = userEvent.setup();
    renderPage(Telemetry);
    await turnOn(user);
    await user.type(screen.getByLabelText("Collector CA"), "not a certificate");
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    expect(await screen.findByText(/collector CA holds no PEM certificate/i)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Restart" })).not.toBeInTheDocument();
  });

  it("is refused a collector CA over 64 KiB (TELEMETRY_INVALID)", async () => {
    signInAs("alice");
    const big = `${MOCK_INTERNAL_CA_PEM}\n`.repeat(Math.ceil(65_537 / MOCK_INTERNAL_CA_PEM.length));
    await expect(
      telemetry.set({
        settings: {
          caPem: big,
          enabled: true,
          endpoint: TELEMETRY_ENDPOINT,
          logs: false,
          skipVerify: false,
        },
      }),
    ).rejects.toThrow(/TELEMETRY_INVALID/);
  });

  it("shows a failed restart's phase, workload and reason, and retries from there", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    applyMockScenario("telemetry-failed");
    const retry = vi.spyOn(telemetry, "retryRestart");
    renderPage(Telemetry);
    const restart = await screen.findByRole("region", { name: "Restart" });
    const failed = within(restart).getByRole("alert");
    expect(failed).toHaveTextContent("The restart stopped at phase services");
    expect(failed).toHaveTextContent("sneakers/deployment/sneakers-audit");
    expect(failed).toHaveTextContent(/isn't back after 5m0s/);
    expect(failed).toHaveTextContent(/Later phases keep the old settings/);
    await user.click(within(restart).getByRole("button", { name: "Retry" }));
    await vi.waitFor(() => expect(retry).toHaveBeenCalled());
    expect(await within(restart).findByText("Restarting")).toBeInTheDocument();
    expect(within(restart).getByText(/Phase services/)).toBeInTheDocument();
    await poll(2);
    expect(await within(restart).findByText("Done")).toBeInTheDocument();
  });

  it("stops a restart at the phase that didn't come back", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    applyMockScenario("telemetry-restart-fails");
    renderPage(Telemetry);
    await turnOn(user);
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    const restart = await screen.findByRole("region", { name: "Restart" });
    await poll(3);
    expect(await within(restart).findByRole("alert")).toHaveTextContent(
      "The restart stopped at phase services",
    );
  });

  it("shows each service with an issue when the collector stops answering", async () => {
    applyMockScenario("telemetry-collector-down");
    renderPage(Telemetry);
    const services = within(await screen.findByRole("table", { name: "Services" }));
    expect(services.getByRole("row", { name: /connector/ })).toHaveTextContent("Issue");
  });

  it("says when the services' states can't be read", async () => {
    applyMockScenario("telemetry-status-down");
    renderPage(Telemetry);
    expect(await screen.findByText(/can't be read while the gateway is down/)).toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Services" })).not.toBeInTheDocument();
  });

  it("keeps what's being typed while the page reads the box again", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage(Telemetry);
    await user.type(await screen.findByLabelText("Endpoint"), "https://half");
    await poll(2);
    expect(screen.getByLabelText("Endpoint")).toHaveValue("https://half");
  });

  it("asks for a fresh code before it saves", async () => {
    signInAs("alice");
    applyMockScenario("stepup");
    const user = userEvent.setup();
    renderPage(() => (
      <>
        <Telemetry />
        <StepUpDialog />
      </>
    ));
    await turnOn(user);
    await user.click(screen.getByRole("button", { name: "Save and restart" }));
    const dialog = within(await screen.findByRole("dialog"));
    await user.type(dialog.getByLabelText("Authenticator code"), "123456");
    await user.click(dialog.getByRole("button", { name: "Verify code" }));
    expect(await screen.findByRole("region", { name: "Restart" })).toBeInTheDocument();
  });

  it("has no form when the product reads no telemetry settings", async () => {
    applyMockScenario("telemetry-absent");
    renderPage(Telemetry);
    expect(await screen.findByText(/Sneakers exports no telemetry/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Endpoint")).not.toBeInTheDocument();
  });

  it("has nothing to show with no product installed", async () => {
    applyMockScenario("no-product");
    const get = vi.spyOn(telemetry, "get");
    renderPage(Telemetry);
    expect(await screen.findByText("Nothing here")).toBeInTheDocument();
    expect(get).not.toHaveBeenCalled();
  });

  it("says it isn't available when the box has no Telemetry backend", async () => {
    vi.spyOn(telemetry, "get").mockRejectedValueOnce(
      new OsadminError("unimplemented", "TelemetryService isn't on this box"),
    );
    renderPage(Telemetry);
    expect(await screen.findByText("Telemetry: not available in this release")).toBeInTheDocument();
  });
});
