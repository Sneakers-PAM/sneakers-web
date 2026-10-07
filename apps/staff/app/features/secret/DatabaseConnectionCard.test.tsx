import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DatabaseConnectionCard } from "@/features/secret/DatabaseConnectionCard";

const FIELDS = {
  database: "billing",
  engine: "PostgreSQL",
  password: "do-not-leak-this",
  port: "5432",
  server: "db.example.org",
  username: "svc_app",
};

describe("DatabaseConnectionCard", () => {
  it("shows a connection string and a CLI command, each with its own copy button", async () => {
    const user = userEvent.setup();
    render(<DatabaseConnectionCard fields={FIELDS} />);
    expect(screen.getByText(/psql -h db\.example\.org/)).toBeInTheDocument();
    expect(screen.getByText(/postgresql:\/\/svc_app/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Copy/ }).length).toBeGreaterThanOrEqual(2);
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    await user.click(screen.getByRole("button", { name: "Copy psql" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("psql -h db.example.org"));
  });

  it("renders nothing for a field set with no recognized engine", () => {
    const { container } = render(
      <DatabaseConnectionCard fields={{ ...FIELDS, engine: "Oracle" }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("never shows the password, even as a fallback", () => {
    render(<DatabaseConnectionCard fields={FIELDS} />);
    expect(screen.queryByText(/do-not-leak-this/)).toBeNull();
  });
});
