/* eslint-disable testing-library/no-node-access -- these read the wrapper classes around a heading and a button, which have no accessible role to query. */
import { render, screen } from "@testing-library/react";

import { CardHeader } from "#ui/components/Feedback";

// jsdom does no layout, so these check the classes that keep a long subtitle from squeezing the
// title and the action beside it (#270): the row wraps, and the title and the action keep their
// own width.
describe("CardHeader", () => {
  const render_ = () =>
    render(
      <CardHeader
        aside={<button type="button">Add certificate</button>}
        subtitle="Certificates the box holds, and which endpoint uses which."
        title="Certificates"
      />,
    );

  it("wraps the row so a long subtitle drops to its own line instead of squeezing", () => {
    render_();
    const row = screen.getByRole("heading", { name: "Certificates" }).parentElement;
    expect(row).toHaveClass("flex-wrap");
  });

  it("keeps the title at its own width", () => {
    render_();
    expect(screen.getByRole("heading", { name: "Certificates" })).toHaveClass("shrink-0");
  });

  it("keeps the action at its own width, pushed to the end", () => {
    render_();
    const aside = screen.getByRole("button", { name: "Add certificate" }).parentElement;
    expect(aside).toHaveClass("shrink-0", "ml-auto");
  });
});
