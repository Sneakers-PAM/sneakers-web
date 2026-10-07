import { edge } from "@sneakers-web/edge";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { useEffect, useRef, useState } from "react";

import type { ListModulesResponse } from "@/lib/osadmin/types";

import { runAction } from "@/lib/osadmin/action";
import { modules } from "@/lib/osadmin/client";

export default function Modules() {
  const [data, setData] = useState<ListModulesResponse>();
  const fileInput = useRef<HTMLInputElement>(null);
  const reload = () => void modules.list().then(setData);
  useEffect(reload, []);

  if (!data) return null;

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader eyebrow="Advanced" subtitle={data.platform} title="Add-on modules" />
      <Card>
        <CardHeader title="Available" />
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Name</TableHeaderCell>
              <TableHeaderCell>Version</TableHeaderCell>
              <TableHeaderCell>State</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.available.map((module) => (
              <TableRow key={module.name}>
                <TableCell>{module.name}</TableCell>
                <TableCell>{module.version}</TableCell>
                <TableCell>
                  <Badge tone={module.active ? "ok" : "neutral"}>
                    {module.active ? "active" : "inactive"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex flex-wrap items-center gap-3 border-t border-border p-5.5">
          <input accept=".bin" aria-label="Module .bin file" ref={fileInput} type="file" />
          <Button
            onClick={() => {
              const file = fileInput.current?.files?.[0];
              if (!file) return;
              void runAction(
                async () => {
                  const { uploadId } = await edge.upload(file);
                  return modules.add(uploadId);
                },
                { onSuccess: reload, successMessage: "Module added." },
              );
            }}
          >
            Add from .bin
          </Button>
        </div>
      </Card>
    </div>
  );
}
