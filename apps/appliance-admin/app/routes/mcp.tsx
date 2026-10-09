import { Badge, Card, CardHeader, EmptyState, Label, PageHeader, Switch } from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { GetMcpResponse } from "@/lib/osadmin/types";

import { NotAvailable } from "@/components/NotAvailable";
import { runAction } from "@/lib/osadmin/action";
import { mcp } from "@/lib/osadmin/client";
import { isNotAvailable } from "@/lib/osadmin/errors";
import { useInstalledProduct } from "@/lib/useInstalledProduct";

/** One of the installed product's pages: with no product installed there's nothing here. */
export default function Mcp() {
  const { loaded, product } = useInstalledProduct();
  const [data, setData] = useState<GetMcpResponse>();
  const [unavailable, setUnavailable] = useState(false);
  const reload = () =>
    void mcp
      .get()
      .then(setData)
      .catch((error: unknown) => {
        if (isNotAvailable(error)) setUnavailable(true);
      });
  useEffect(() => {
    if (product) reload();
  }, [product]);

  if (!loaded) return null;
  if (!product) {
    return (
      <div className="p-5.5">
        <EmptyState
          body="This page belongs to a product, and no product is installed on this box."
          loader={false}
          title="Nothing here"
        />
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="p-5.5">
        <NotAvailable name="MCP" />
      </div>
    );
  }
  if (!data) return null;

  const look = stateLook(data, product.name);
  const switchable = data.state === "on" || data.state === "off";
  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow={product.name} title="MCP" />
      <Card>
        <CardHeader
          aside={<Badge tone={look.tone}>{look.label}</Badge>}
          subtitle="The product's MCP server, for agents. Switching it needs a fresh code."
          title="MCP"
        />
        <div className="flex flex-col gap-4 p-5.5">
          <p className="m-0 text-small">{look.sentence}</p>
          {switchable && (
            <>
              <div className="flex items-center gap-3">
                <Label className="flex items-center gap-3">
                  <Switch
                    checked={data.mcpEnabled}
                    onCheckedChange={(checked) =>
                      void runAction(() => mcp.set(checked, data.machineApiEnabled), {
                        onSuccess: reload,
                      })
                    }
                  />
                  MCP on
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Label className="flex items-center gap-3">
                  <Switch
                    checked={data.machineApiEnabled}
                    disabled={!data.mcpEnabled}
                    onCheckedChange={(checked) =>
                      void runAction(() => mcp.set(data.mcpEnabled, checked), {
                        onSuccess: reload,
                      })
                    }
                  />
                  Machine API on
                </Label>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * The words osadmin's GetMcp answers with (the product's mcp switch, from its product.yaml),
 * as a badge and one sentence. Any other word is shown as the box gave it.
 */
const stateLook = (
  data: GetMcpResponse,
  productName: string,
): { label: string; sentence: string; tone: "neutral" | "ok" | "warn" } => {
  switch (data.state) {
    case "not installed": {
      return {
        label: "Not installed",
        sentence:
          "MCP isn't installed on this box yet: install the product on Updates, and its MCP switch shows here.",
        tone: "warn",
      };
    }
    case "not in this product": {
      return {
        label: "Not in this product",
        sentence: `${productName} has no MCP server, so there's nothing to switch on.`,
        tone: "neutral",
      };
    }
    case "off": {
      return {
        label: "Off",
        sentence: `MCP is off: agents can't reach ${productName} through MCP. Switching it on starts the product's MCP server.`,
        tone: "neutral",
      };
    }
    case "on": {
      return {
        label: "On",
        sentence: `MCP is on: agents can reach ${productName} through MCP, each with its own sign-in.`,
        tone: "ok",
      };
    }
    default: {
      return { label: data.state || "Unknown", sentence: "", tone: "neutral" };
    }
  }
};
