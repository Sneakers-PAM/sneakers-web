import { Badge, Card, CardHeader, Label, PageHeader, Switch } from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { GetMcpResponse } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { mcp } from "@/lib/osadmin/client";

export default function Mcp() {
  const [data, setData] = useState<GetMcpResponse>();
  const reload = () => void mcp.get().then(setData);
  useEffect(reload, []);

  if (!data) return null;

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Appliance" title="MCP" />
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
