import { render, screen } from "@testing-library/react";

import { Table, TableBody, TableCell, TableRow } from "#ui/components/Table";

describe("TableBody striping", () => {
  it("shades even rows when striped, and leaves rows plain otherwise", () => {
    const rows = (striped?: boolean) => (
      <Table>
        <TableBody striped={striped}>
          <TableRow>
            <TableCell>One</TableCell>
          </TableRow>
          <TableRow>
            <TableCell>Two</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    );
    const { unmount } = render(rows());
    expect(screen.getByRole("rowgroup")).not.toHaveClass("[&>tr:nth-child(even)]:bg-sunken/50");
    unmount();

    render(rows(true));
    expect(screen.getByRole("rowgroup")).toHaveClass("[&>tr:nth-child(even)]:bg-sunken/50");
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
});
