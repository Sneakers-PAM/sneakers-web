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

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow={product.name} title="MCP" />
      <Card>
        <CardHeader subtitle={data.state} title="MCP" />
        <div className="flex flex-col gap-4 p-5.5">
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
            <Badge tone={data.mcpEnabled ? "ok" : "neutral"}>{data.state}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <Label className="flex items-center gap-3">
              <Switch
                checked={data.machineApiEnabled}
                disabled={!data.mcpEnabled}
                onCheckedChange={(checked) =>
                  void runAction(() => mcp.set(data.mcpEnabled, checked), { onSuccess: reload })
                }
              />
              Machine API on
            </Label>
          </div>
        </div>
      </Card>
    </div>
  );
}
