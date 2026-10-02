/* eslint-disable testing-library/no-container, testing-library/no-node-access -- these check the drawn SVG and the absence of an element, which have no accessible role to query. */
import { render, screen } from "@testing-library/react";

import { Mark } from "#ui/brand/Mark";

describe("Mark", () => {
  it("draws the keyhole at large sizes", () => {
    const { container } = render(<Mark size={120} />);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
    expect(container.querySelectorAll("rect")).toHaveLength(2);
  });

  it("uses a plain round hole at 32 px and below, and no hole at 16 px", () => {
    const { container: small } = render(<Mark size={24} />);
    expect(small.querySelectorAll("rect")).toHaveLength(1);
    expect(small.querySelectorAll("circle")).toHaveLength(1);
    const { container: favicon } = render(<Mark size={16} />);
    expect(favicon.querySelectorAll("circle")).toHaveLength(0);
  });

  it("is decorative unless it has a title", () => {
    const { container } = render(
      <>
        <Mark />
        <Mark title="Sneakers-PAM" />
      </>,
    );
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("img", { name: "Sneakers-PAM" })).toBeInTheDocument();
  });
});
