import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Segmented,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { useState } from "react";

import { type Platform, shortcutRows } from "@/features/targets/terminal/keys";

/** D-16: the terminal's keyboard shortcuts, for this keyboard first. */
export const ShortcutsDialog = ({
  onOpenChange,
  open,
  platform,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  platform: Platform;
}) => {
  const [shown, setShown] = useState<Platform>(platform);
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Shown for {shown === "mac" ? "macOS" : "Windows and Linux"}.{" "}
            {shown === "mac"
              ? "Windows and Linux use Ctrl instead of ⌘."
              : "macOS uses ⌘ instead of Ctrl."}
          </DialogDescription>
        </DialogHeader>
        <Segmented
          label="Keyboard"
          onChange={setShown}
          options={[
            { label: "macOS", value: "mac" },
            { label: "Windows / Linux", value: "other" },
          ]}
          size="sm"
          value={shown}
        />
        <Table>
          <TableHead>
            <tr>
              <TableHeaderCell>Action</TableHeaderCell>
              <TableHeaderCell className="text-right">Keys</TableHeaderCell>
            </tr>
          </TableHead>
          <TableBody>
            {shortcutRows(shown).map((r) => (
              <TableRow key={r.action}>
                <TableCell>{r.action}</TableCell>
                <TableCell className="text-right">
                  <kbd className="rounded-xs border border-border-strong bg-sunken px-2 py-1 font-mono text-small whitespace-nowrap">
                    {r.keys}
                  </kbd>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
