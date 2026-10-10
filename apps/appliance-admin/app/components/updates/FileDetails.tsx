import { Badge } from "@sneakers-web/ui";

import { CopyIconButton } from "@/components/CopyIconButton";
import { megabytes } from "@/components/updates/OfferList";

/** The kind a generated file name says it is, read instead of shown: Base Web's own pages,
 * a patch (named "-patch-"), or a full file of any other unit. */
const kindLabel = (fileName: string): string => {
  if (fileName.startsWith("sneakers-appliance-baseWeb-")) return "Web";
  if (fileName.includes("-patch-")) return "Patch";
  return "Full";
};

/**
 * Files: what kind the box holds and, once known, its size, with a copy icon for the file
 * name itself -- never the generated name as text, which for a lab build runs well past a
 * card's width.
 */
export const FileDetails = ({ fileName, size }: { fileName: string; size?: string }) => (
  <p className="m-0 flex flex-wrap items-center gap-2 text-small text-muted">
    <span className="font-bold">Files</span>
    <Badge tone="neutral">{kindLabel(fileName)}</Badge>
    {size && <span>{megabytes(size)}</span>}
    <CopyIconButton label="Copy the file name" value={fileName} />
  </p>
);
