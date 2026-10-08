import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CodeStep } from "@/features/setup/CodeStep";

describe("CodeStep", () => {
  it("shows what's typed in capitals, grouped in fours with dashes", async () => {
    const user = userEvent.setup();
    render(<CodeStep onRedeemed={() => {}} />);
    const input = screen.getByLabelText("Setup code");
    await user.type(input, "7pqknms9xd2a4kjw");
    expect(input).toHaveValue("7PQK-NMS9-XD2A-4KJW");
  });

  it("formats a pasted code that already has spaces and lower case", async () => {
    const user = userEvent.setup();
    render(<CodeStep onRedeemed={() => {}} />);
    const input = screen.getByLabelText("Setup code");
    await user.click(input);
    await user.paste("7pqk nms9 xd2a 4kjw");
    expect(input).toHaveValue("7PQK-NMS9-XD2A-4KJW");
  });

  it("drops anything typed past 16 characters", async () => {
    const user = userEvent.setup();
    render(<CodeStep onRedeemed={() => {}} />);
    const input = screen.getByLabelText("Setup code");
    await user.type(input, "7pqknms9xd2a4kjwzzzz");
    expect(input).toHaveValue("7PQK-NMS9-XD2A-4KJW");
  });
});
