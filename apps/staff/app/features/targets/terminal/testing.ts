import type { CreateScreen, Screen } from "@/features/targets/terminal/screen";

/*
 * A stand-in screen for page tests: what the session writes shows up as plain text in the
 * mount (colour codes dropped), and `type` sends input as if typed. Tests only.
 */

const ignore = () => {};

const ANSI = /\u001B\[[0-9;?]*[A-Za-z]/g;

export interface FakeScreen extends Screen {
  type: (text: string) => void;
}

export const fakeScreens = (): { create: CreateScreen; last: () => FakeScreen | undefined } => {
  let latest: FakeScreen | undefined;
  const create: CreateScreen = (mount) => {
    const pre = document.createElement("pre");
    pre.dataset.testid = "terminal-output";
    mount.append(pre);
    let input: (data: string) => void = ignore;
    const decoder = new TextDecoder();
    const screen: FakeScreen = {
      blur: () => {},
      dispose: () => pre.remove(),
      fit: () => {},
      focus: () => {},
      onInput: (handler) => {
        input = handler;
      },
      onKey: () => {},
      onResize: () => {},
      reset: () => {
        pre.textContent = "";
      },
      selection: () => "",
      setFontSize: () => {},
      size: () => ({ cols: 80, rows: 24 }),
      type: (text) => input(text),
      write: (data) => {
        const text = typeof data === "string" ? data : decoder.decode(data);
        pre.textContent += text.replaceAll(ANSI, "").replaceAll("\r", "");
      },
    };
    latest = screen;
    return Promise.resolve(screen);
  };
  return { create, last: () => latest };
};
