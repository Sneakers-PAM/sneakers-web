import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { Advanced } from "@/components/Advanced";

describe("Advanced", () => {
  it("is collapsed until opened", async () => {
    const user = userEvent.setup();
    render(
      <Advanced label="Advanced: trust and PKI">
        <p>CA bundle details</p>
      </Advanced>,
    );
    expect(screen.getByText("CA bundle details")).not.toBeVisible();
    await user.click(screen.getByText("Advanced: trust and PKI"));
    expect(screen.getByText("CA bundle details")).toBeVisible();
  });
});
