import {
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";
import { Link } from "react-router";

import type { GetBackupsResponse, RecoveryKey } from "@/lib/osadmin/types";

import { NotAvailable } from "@/components/NotAvailable";
import { runAction } from "@/lib/osadmin/action";
import { backup, setup } from "@/lib/osadmin/client";
import { isNotAvailable } from "@/lib/osadmin/errors";

export default function Backups() {
  const [data, setData] = useState<GetBackupsResponse>();
  const [recoveryKeys, setRecoveryKeys] = useState<RecoveryKey[]>();
  const [schedule, setSchedule] = useState("");
  const [retentionDays, setRetentionDays] = useState(30);
  const [targets, setTargets] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const reload = () =>
    void backup
      .get()
      .then((response) => {
        setData(response);
        setSchedule(response.policy?.schedule ?? "");
        setRetentionDays(response.policy?.retentionDays ?? 30);
        setTargets((response.policy?.targets ?? []).join(", "));
      })
      .catch((error: unknown) => {
        if (isNotAvailable(error)) setUnavailable(true);
      });
  useEffect(reload, []);
  // A refused GetSetup (an old box, or a session that just ended) leaves the keys unlisted.
  useEffect(
    () =>
      void setup
        .get()
        .then((response) => setRecoveryKeys(response.recoveryKeys))
        .catch(() => null),
    [],
  );

  if (unavailable) {
    return (
      <div className="p-5.5">
        <NotAvailable name="Backups" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="flex flex-col gap-5 p-5.5">
      <PageHeader
        actions={
          <Button onClick={() => void runAction(() => backup.run(), { onSuccess: reload })}>
            Run now
          </Button>
        }
        eyebrow="Appliance"
        title="Backups"
      />
      <Card>
        <CardHeader
          aside={<Link to="/setup">Manage recovery keys</Link>}
          subtitle={`${String(recoveryKeys?.length ?? 0)} set`}
          title="Recovery keys"
        />
        <div className="flex flex-col gap-1 p-5.5 font-mono text-[0.8125rem]">
          {(recoveryKeys ?? []).map((key) => (
            <p key={key.fingerprint}>
              {key.fingerprint} ({key.label})
            </p>
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Policy" />
        <form
          className="flex flex-col gap-3 p-5.5"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(
              () =>
                backup.setPolicy({
                  retentionDays,
                  schedule,
                  targets: targets
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                }),
              { onSuccess: reload },
            );
          }}
        >
          <Field hint="HH:MM local" label="Schedule">
            <Input onChange={(event) => setSchedule(event.target.value)} value={schedule} />
          </Field>
          <Field label="Retention (days)">
            <Input
              onChange={(event) => setRetentionDays(Number(event.target.value))}
              type="number"
              value={retentionDays}
            />
          </Field>
          <Field hint="Comma-separated" label="Targets">
            <Input onChange={(event) => setTargets(event.target.value)} value={targets} />
          </Field>
          <Button type="submit">Save policy</Button>
        </form>
      </Card>
      <Card>
        <CardHeader title="Backup sets" />
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>ID</TableHeaderCell>
              <TableHeaderCell>Taken</TableHeaderCell>
              <TableHeaderCell>Target</TableHeaderCell>
              <TableHeaderCell>Size</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {data.sets.map((set) => (
              <TableRow key={set.id}>
                <TableCell className="font-mono text-[0.8125rem]">{set.id}</TableCell>
                <TableCell>{set.taken}</TableCell>
                <TableCell>{set.target}</TableCell>
                <TableCell>{set.sizeBytes}</TableCell>
                <TableCell>
                  <Button
                    onClick={() =>
                      void runAction(() => backup.restore(set.id), { successMessage: "Restoring." })
                    }
                    size="sm"
                    variant="secondary"
                  >
                    Restore
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
