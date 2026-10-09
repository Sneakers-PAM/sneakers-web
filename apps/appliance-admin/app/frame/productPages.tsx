import type { ReactNode } from "react";

import { Import, Network } from "lucide-react";

/** A page that belongs to the installed product, not to the base appliance. */
export interface ProductPage {
  icon: ReactNode;
  label: string;
  to: string;
}

/**
 * The installed product's pages. The nav shows them in a section named after the product,
 * and only while one is installed; the base sections never list them.
 */
export const productPages: ProductPage[] = [
  { icon: <Network />, label: "MCP", to: "/mcp" },
  { icon: <Import />, label: "Import", to: "/import" },
];
