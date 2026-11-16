import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  QrBlock,
} from "@sneakers-web/ui";

/** The short link a label holds (#387). It points at the secret and carries no value. */
export const secretLink = (origin: string, id: string) => `${origin}/s/${encodeURIComponent(id)}`;

/** A printable QR code for a secret's /s/<id> link (#387). */
export const PrintQrDialog = ({
  id,
  name,
  onOpenChange,
  open,
  origin,
}: {
  id: string;
  name: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  origin: string;
}) => {
  const link = secretLink(origin, id);
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Print QR code</DialogTitle>
          <DialogDescription>
            The code holds no value and grants no access. It only opens this secret&apos;s page, and
            the usual access checks decide what a person sees.
          </DialogDescription>
        </DialogHeader>
        <div className="print-label flex flex-col items-center gap-3 py-2" data-print-label>
          <QrBlock label={`QR code for ${name}`} size={220} value={link} />
          <p className="text-[1rem] font-bold">{name}</p>
          <p className="font-mono text-[0.75rem] break-all text-muted">{link}</p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="secondary">
            Close
          </Button>
          <Button onClick={() => globalThis.print()}>Print</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
