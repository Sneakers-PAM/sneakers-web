import { QRCodeSVG } from "qrcode.react";

import { cn } from "#ui/lib/cn";

/** A real QR code on a white tile (codes stay dark-on-white in every theme so phones read them). */
export const QrBlock = ({
  className,
  label,
  size = 148,
  value,
}: {
  className?: string;
  label: string;
  size?: number;
  value: string;
}) => {
  return (
    <div className={cn("w-max shrink-0 rounded-lg bg-white p-2.5", className)}>
      <QRCodeSVG fgColor="#111111" marginSize={0} size={size} title={label} value={value} />
    </div>
  );
};
