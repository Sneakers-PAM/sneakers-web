import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { createXtermScreen } from "@/features/targets/terminal/screen";

const mount = () => {
  const element = document.createElement("div");
  document.body.append(element);
  return element;
};

describe("the xterm screen", () => {
  it("passes what's typed to the session, and keeps a shortcut the page takes", async () => {
    const element = mount();
    const screen = await createXtermScreen(element, { fontSize: 14 });
    const typed: string[] = [];
    screen.onInput((d) => typed.push(d));
    screen.onKey((event) => !(event.ctrlKey && event.shiftKey && event.key === "C"));
    const input = within(element).getByRole("textbox", { name: "Terminal input" });
    await userEvent.type(input, "ls");
    await userEvent.keyboard("{Control>}{Shift>}C{/Shift}{/Control}");
    expect(typed.join("")).toBe("ls");
    screen.write("hello\r\n");
    screen.setFontSize(16);
    screen.dispose();
    expect(within(element).queryByRole("textbox")).toBeNull();
  });
});
