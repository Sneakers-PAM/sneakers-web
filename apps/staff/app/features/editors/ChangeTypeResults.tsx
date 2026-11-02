import {
  Button,
  Card,
  CardHeader,
  Pill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { Check, SkipForward } from "lucide-react";

import type { ChangeOutcome } from "@/features/editors/changeType";

/** The end of a selection: what came of each secret in it. */
export const ChangeTypeResults = ({
  onDone,
  outcomes,
}: {
  onDone: () => void;
  outcomes: ChangeOutcome[];
}) => (
  <Card>
    <CardHeader title="Results" />
    <div className="flex flex-col gap-4 p-5.5">
      <Table aria-label="Results">
        <TableHead>
          <tr>
            <TableHeaderCell>Secret</TableHeaderCell>
            <TableHeaderCell>Result</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {outcomes.map((o) => (
            <TableRow key={o.id}>
              <TableCell>
                {o.name}
                {o.detail && <span className="block text-small text-muted">{o.detail}</span>}
              </TableCell>
              <TableCell>
                {o.status === "changed" ? (
                  <Pill icon={<Check aria-hidden />} tone="ok">
                    Changed
                  </Pill>
                ) : (
                  <Pill icon={<SkipForward aria-hidden />} tone="neutral">
                    Skipped
                  </Pill>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Button className="self-end" onClick={onDone}>
        Done
      </Button>
    </div>
  </Card>
);
