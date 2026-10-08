import { CodeInput, Field, QrBlock } from "@sneakers-web/ui";

import type { TotpEnrolment } from "@/lib/osadmin/types";

/** Groups of four, easier to type and to read aloud. */
export const groupsOfFour = (value: string, separator = " "): string =>
  value.match(/.{1,4}/g)?.join(separator) ?? "";

/**
 * A new authenticator: the QR code for the app, the key typed by hand for an app that
 * can't scan, and the code it then shows, which proves the app has it.
 */
export const TotpEnrolmentPanel = ({
  code,
  enrolment,
  onCode,
}: {
  code: string;
  enrolment: TotpEnrolment;
  onCode: (code: string) => void;
}) => (
  <div className="flex flex-col gap-4">
    <p className="m-0 text-body">1. Scan this with your authenticator app:</p>
    <div className="flex flex-col gap-4 tablet:flex-row tablet:items-center">
      <QrBlock label="QR code for your authenticator app" value={enrolment.uri} />
      <div className="flex flex-col gap-1.5 text-small">
        <span className="text-muted">Can&apos;t scan? Type this key:</span>
        <code className="font-mono text-body font-bold break-words">
          {groupsOfFour(enrolment.secret)}
        </code>
        <span className="text-muted">
          {enrolment.digits} digits, every {enrolment.periodSeconds} seconds ({enrolment.algorithm})
        </span>
      </div>
    </div>
    <Field label="6-digit code from the app">
      <CodeInput label="6-digit code from the app" onChange={onCode} size="md" value={code} />
    </Field>
  </div>
);
