import { render, screen, within } from "@testing-library/react";

import { ApprovalMatrix } from "@/features/agents/ApprovalMatrix";

const cell = (row: string, column: string) => {
  const table = screen.getByRole("table", { name: "How approvals work" });
  const columns = within(table)
    .getAllByRole("columnheader")
    .map((h) => h.textContent);
  const tr = within(table)
    .getAllByRole("row")
    .find((r) => within(r).queryByRole("rowheader", { name: row }))!;
  return within(tr).getAllByRole("cell")[columns.indexOf(column) - 1]!;
};

describe("How approvals work", () => {
  it("is a real table with column and row headers", () => {
    render(<ApprovalMatrix />);
    const table = screen.getByRole("table", { name: "How approvals work" });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((h) => h.textContent),
    ).toEqual(["You are…", "Normal secret", "Approval-required secret", "Always-approve secret"]);
    expect(
      within(table)
        .getAllByRole("rowheader")
        .map((h) => h.textContent),
    ).toEqual([
      "An owner (one of possibly several)",
      "Not an owner, but you can read it",
      "No read access",
      "An emergency, with no one able to approve in time",
    ]);
  });

  it("says who approves at each level, never the requester", () => {
    render(<ApprovalMatrix />);
    const owner = "An owner (one of possibly several)";
    const reader = "Not an owner, but you can read it";
    expect(cell(owner, "Normal secret")).toHaveTextContent("Just works");
    expect(cell(owner, "Approval-required secret")).toHaveTextContent("Owners are exempt");
    expect(cell(owner, "Always-approve secret")).toHaveTextContent(
      "Another owner or a designated approver approves. Never you.",
    );
    expect(cell(reader, "Normal secret")).toHaveTextContent("Just works");
    expect(cell(reader, "Approval-required secret")).toHaveTextContent("Any one owner");
    expect(cell("No read access", "Always-approve secret")).toHaveTextContent("Refused");
    expect(
      cell("An emergency, with no one able to approve in time", "Normal secret"),
    ).toHaveTextContent("Break-the-glass");
  });

  it("covers the sole-approver rules, what never needs approval, MFA and one prompt per task", () => {
    render(<ApprovalMatrix />);
    expect(screen.getByRole("region", { name: "When nobody else can approve" })).toHaveTextContent(
      /confirm the task once with your second factor/,
    );
    expect(screen.getByRole("region", { name: "Never needs approval" })).toHaveTextContent(
      /Creating or generating.*Updating or rotating/,
    );
    const mfa = screen.getByRole("region", { name: "Second factor" });
    expect(mfa).toHaveTextContent(/no more prompts for 30 minutes/);
    expect(mfa).toHaveTextContent(/once, at \/login/);
    expect(screen.getByRole("region", { name: "One task, one prompt" })).toBeInTheDocument();
  });
});
