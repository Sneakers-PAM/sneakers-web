import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PrintQrDialog, secretLink } from "@/features/secret/PrintQrDialog";

describe("secretLink", () => {
  it("builds the short /s/<id> link on the app's own address", () => {
    expect(secretLink("https://box.example.org", "mock-secret-db-admin")).toBe(
      "https://box.example.org/s/mock-secret-db-admin",
    );
  });

  it("keeps an id with reserved characters in one path segment", () => {
    expect(secretLink("https://box.example.org", "a/b")).toBe("https://box.example.org/s/a%2Fb");
  });
});

const open = () =>
  render(
    <PrintQrDialog
      id="mock-secret-db-admin"
      name="DB admin"
      onOpenChange={() => {}}
      open
      origin="https://box.example.org"
    />,
  );

describe("PrintQrDialog", () => {
  it("shows a code for the link, with the secret's name and the link as text", () => {
    open();
    expect(screen.getByRole("dialog", { name: "Print QR code" })).toBeInTheDocument();
    expect(screen.getByTitle("QR code for DB admin")).toBeInTheDocument();
    expect(screen.getByText("https://box.example.org/s/mock-secret-db-admin")).toBeInTheDocument();
  });

  it("says the code holds no value and grants no access", () => {
    open();
    expect(screen.getByText(/holds no value and grants no access/i)).toBeInTheDocument();
  });

  it("prints on request", async () => {
    const print = vi.spyOn(globalThis, "print").mockImplementation(() => {});
    open();
    await userEvent.setup().click(screen.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledOnce();
  });
});
