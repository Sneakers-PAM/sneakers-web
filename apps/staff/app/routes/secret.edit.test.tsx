import { mockState } from "@sneakers-web/mock-gateway";
import { withMockGateway } from "@sneakers-web/mock-gateway/testing";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useParams } from "react-router";

import * as editor from "@/routes/secret.edit";
import { renderRoute } from "@/test/routeStub";

withMockGateway();

const Landed = () => <h1>Landed on {useParams().id}</h1>;

const routes = [
  {
    action: editor.action,
    Component: editor.default,
    ErrorBoundary: editor.ErrorBoundary,
    loader: editor.loader,
    path: "/secret/:id/edit",
  },
  { Component: Landed, path: "/secret/:id" },
];

const open = (id: string, user?: string) => renderRoute(`/secret/${id}/edit`, routes, { user });
const card = (name: string) => screen.getByRole("region", { name });
const DB = "mock-secret-db-admin";
const database = () => mockState.world.secrets.find((s) => s.id === DB);

describe("the edit secret page", () => {
  it("fills in the stored values but never a sensitive one, and keeps it when left blank", async () => {
    const user = userEvent.setup();
    open(DB);
    expect(
      await screen.findByRole("heading", { level: 1, name: "Edit DB admin" }),
    ).toBeInTheDocument();
    const fields = card("Fields");
    expect(within(fields).getByRole("textbox", { name: /Username/ })).toHaveValue("postgres_admin");
    const password = within(fields).getByLabelText(/^Password/);
    expect(password).toHaveValue("");
    expect(password).toHaveAttribute("placeholder", "Leave blank to keep the current value");
    expect(document.body).not.toHaveTextContent("mock-Tongue-Eyelet-91");
    expect(screen.getByRole("combobox", { name: /Type/ })).toBeDisabled();

    const port = within(fields).getByRole("textbox", { name: /Port/ });
    await user.clear(port);
    await user.type(port, "5433");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("heading", { name: `Landed on ${DB}` })).toBeInTheDocument();
    expect(database()?.fields).toMatchObject({ password: "mock-Tongue-Eyelet-91", port: "5433" });
    expect(database()?.versions[0]?.changedFieldKeys).toContain("port");
  });

  it("shows the gateway's refusal when someone who can't edit the secret saves", async () => {
    const user = userEvent.setup();
    open(DB, "mock-user-bob");
    await screen.findByRole("heading", { level: 1, name: "Edit DB admin" });
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Couldn't save the secret")).toBeInTheDocument();
    expect(screen.getByText("You don't have permission to do that.")).toBeInTheDocument();
  });

  it("answers not found for a secret the person can't see", async () => {
    open("mock-secret-alice-wifi", "mock-user-bob");
    expect(await screen.findByText("Secret not found")).toBeInTheDocument();
  });

  it("points certificates at Replace certificate instead of fields", async () => {
    open("mock-secret-portal-cert", "mock-user-carol");
    expect(
      await screen.findByRole("heading", { level: 1, name: /Edit portal\.example\.org/ }),
    ).toBeInTheDocument();
    expect(within(card("Certificate")).getByText(/Replace certificate/)).toBeInTheDocument();
  });
});
