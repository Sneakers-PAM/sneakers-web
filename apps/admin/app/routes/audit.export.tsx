import type { LoaderFunctionArgs } from "react-router";

import { adminLoad } from "@/lib/admin.server";
import { filtersFrom, readAudit } from "@/lib/audit.server";

const COLUMNS = [
  "seq",
  "occurredAt",
  "tier",
  "action",
  "actorUserId",
  "actorName",
  "subject",
  "groupId",
  "sensitive",
  "attributes",
  "prevHash",
  "hash",
] as const;

/** RFC 4180: quote every field, double the quotes inside. */
const cell = (value: unknown) => `"${String(value).replaceAll('"', '""')}"`;

/**
 * The records the page shows, as a download: CSV, or JSON lines (one record per line, with
 * its hashes, so the chain can be checked elsewhere).
 */
export const loader = ({ request }: LoaderFunctionArgs) =>
  adminLoad(request, async (gw) => {
    const url = new URL(request.url);
    const format = url.searchParams.get("format") === "jsonl" ? "jsonl" : "csv";
    const { records } = await readAudit(gw, filtersFrom(url));
    const stamp = new Date().toISOString().slice(0, 10);
    const body =
      format === "jsonl"
        ? records.map((r) => JSON.stringify(r)).join("\n") + (records.length > 0 ? "\n" : "")
        : [
            COLUMNS.join(","),
            ...records.map((r) =>
              COLUMNS.map((c) =>
                cell(
                  c === "attributes"
                    ? r.attributes.map((a) => `${a.key}=${a.value}`).join("; ")
                    : r[c],
                ),
              ).join(","),
            ),
          ].join("\r\n");
    return new Response(body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="sneakers-audit-${stamp}.${format}"`,
        "Content-Type":
          format === "jsonl" ? "application/x-ndjson; charset=utf-8" : "text/csv; charset=utf-8",
      },
    });
  });
