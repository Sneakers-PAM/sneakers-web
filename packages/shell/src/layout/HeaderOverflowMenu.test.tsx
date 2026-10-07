import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Mail } from "lucide-react";

import { HeaderOverflowMenu } from "#shell/layout/HeaderOverflowMenu";

/** Simulate a screen of `widthPx`: every `min-width` media query answers for that width. */
const atWidth = (widthPx: number): (() => void) => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query);
    return {
      addEventListener: () => {},
      addListener: () => {},
      dispatchEvent: () => false,
      matches: min ? widthPx >= Number(min[1]) : false,
      media: query,
      onchange: null,
      removeEventListener: () => {},
      removeListener: () => {},
    };
  }) as typeof globalThis.matchMedia;
  return () => {
    globalThis.matchMedia = original;
  };
};

const items = (onClick: () => void) => [
  {
    "aria-label": "Approvals",
    badge: 3,
    icon: <Mail aria-hidden className="size-4" />,
    key: "approvals",
    label: "Approvals",
    onClick,
  },
  {
    href: "/admin/",
    icon: <Mail aria-hidden className="size-4" />,
    key: "admin",
    label: "Admin console",
  },
];

describe("HeaderOverflowMenu", () => {
  it("renders nothing when there are no actions", () => {
    const { container } = render(<HeaderOverflowMenu actions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders every action inline at full desktop width", () => {
    const restore = atWidth(1440);
    try {
      render(<HeaderOverflowMenu actions={items(() => {})} />);
      expect(screen.getByRole("link", { name: "Admin console" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Approvals" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
    } finally {
      restore();
    }
  });

  it("collapses into one overflow menu below full desktop width, keeping every action reachable", async () => {
    const restore = atWidth(1024);
    try {
      const user = userEvent.setup();
      const onClick = vi.fn();
      render(<HeaderOverflowMenu actions={items(onClick)} />);
      expect(screen.queryByRole("link", { name: "Admin console" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Approvals" })).toBeNull();
      await user.click(screen.getByRole("button", { name: "More actions" }));
      await user.click(await screen.findByRole("menuitem", { name: /Approvals/ }));
      expect(onClick).toHaveBeenCalledTimes(1);
      await user.click(screen.getByRole("button", { name: "More actions" }));
      expect(await screen.findByRole("menuitem", { name: /Admin console/ })).toHaveAttribute(
        "href",
        "/admin/",
      );
    } finally {
      restore();
    }
  });
});
