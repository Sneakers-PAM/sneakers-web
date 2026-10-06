import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
} from "@sneakers-web/ui";
import { type ReactNode, useState } from "react";

import { useBrowseAction } from "@/features/browse/useBrowseAction";

/** D-05 New folder and Rename: one name, posted as `fields` plus `name`. */
export const NameDialog = ({
  action,
  description,
  fields,
  initial = "",
  onClose,
  submitLabel,
  title,
}: {
  /** Where to post: the frame sidebar targets `/browse` explicitly, off the browse route. */
  action?: string;
  description: ReactNode;
  fields: Record<string, string>;
  initial?: string;
  onClose: () => void;
  submitLabel: string;
  title: string;
}) => {
  const [name, setName] = useState(initial);
  const { busy, error, submit } = useBrowseAction(onClose, action);
  const trimmed = name.trim();
  return (
    <Dialog onOpenChange={(o) => !o && onClose()} open>
      <DialogContent className="max-w-[29rem]" hideClose>
        <form
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            if (trimmed && trimmed !== initial) submit({ ...fields, name: trimmed });
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <Field label="Name">
            <Input maxLength={120} onChange={(event) => setName(event.target.value)} value={name} />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <DialogFooter>
            <Button onClick={onClose} type="button" variant="secondary">
              Cancel
            </Button>
            <Button
              disabled={!trimmed || trimmed === initial}
              loading={busy}
              loadingLabel={submitLabel}
              type="submit"
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
