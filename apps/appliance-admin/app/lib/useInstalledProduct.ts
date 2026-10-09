import { useEffect, useState } from "react";

import { upgrade } from "@/lib/osadmin/client";

/** The product installed on the box, as the box names it. */
export interface InstalledProduct {
  /** Its name for people, such as "Sneakers": the label of its own nav section. */
  name: string;
  version: string;
}

export interface InstalledProductState {
  /** The box has answered; until then nothing product-only is shown. */
  loaded: boolean;
  /** Undefined while no product is installed. */
  product?: InstalledProduct;
}

/**
 * Reads the installed product from the box's product slots (`GetUpgrades.product`), again
 * whenever `refresh` changes. The base appliance shows nothing of a product's until the box
 * names one.
 */
export const useInstalledProduct = (enabled = true, refresh?: unknown): InstalledProductState => {
  const [state, setState] = useState<InstalledProductState>({ loaded: false });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void upgrade
      .get()
      .then((response) => {
        const name = response.product?.name ?? "";
        const version = response.product?.installedVersion ?? "";
        if (live)
          setState({ loaded: true, product: name && version ? { name, version } : undefined });
      })
      .catch(() => {
        if (live) setState({ loaded: true });
      });
    return () => {
      live = false;
    };
  }, [enabled, refresh]);
  return state;
};
