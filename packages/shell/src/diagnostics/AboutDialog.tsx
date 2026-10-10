import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Spinner,
} from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import {
  type DiagnosticsData,
  featureText,
  inUse,
  isFeature,
  NOT_CONFIGURED,
  productText,
  shortCommit,
} from "#shell/diagnostics/report";

/** A component as the gateway answers it (or as the report keeps it). */
interface ComponentLike {
  commit?: null | string;
  dependencies?: null | readonly { name: string; state: string }[];
  name: string;
  status: string;
  version: null | string;
}

import { loadDiagnostics } from "#shell/diagnostics/copy";
import { CopyDiagnostics, DiagnosticsUrl } from "#shell/diagnostics/CopyDiagnostics";

const buildOf = (c: ComponentLike): string => {
  const version = c.version ?? "unknown";
  return c.commit ? `${version} (${shortCommit(c.commit)})` : version;
};

const versionOf = (c: ComponentLike): string => {
  const head = c.status === "OK" ? buildOf(c) : c.status.toLowerCase().replace("_", " ");
  const trouble = (c.dependencies ?? [])
    .filter((d) => d.state !== "OK")
    .map((d) => `${d.name} ${d.state.toLowerCase()}`);
  return trouble.length > 0 ? `${head} · ${trouble.join(", ")}` : head;
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex gap-3 py-1 text-[0.875rem]">
    <dt className="w-32 flex-none text-muted">{label}</dt>
    <dd className="m-0 min-w-0 font-mono text-[0.8125rem] break-all">{value}</dd>
  </div>
);

/** A feature the owner switches: "off", or "on" with its build or trouble. */
const featureOf = (c: ComponentLike): string =>
  featureText(
    c.status === NOT_CONFIGURED
      ? { build: null, name: c.name, on: false }
      : { build: versionOf(c), name: c.name, on: true },
  );

const Section = ({
  items,
  title,
  value = versionOf,
}: {
  items: readonly ComponentLike[];
  title: string;
  value?: (c: ComponentLike) => string;
}) =>
  items.length === 0 ? null : (
    <section aria-label={title} className="flex flex-col gap-1">
      <h3 className="m-0 text-small font-bold">{title}</h3>
      <dl className="m-0">
        {items.map((c, index) => (
          // One service can answer more than once (a connector per worker).
          <Row key={`${c.name}-${index}`} label={c.name} value={value(c)} />
        ))}
      </dl>
    </section>
  );

const Body = ({ url }: { url: string }) => {
  const [data, setData] = useState<DiagnosticsData | null | undefined>();
  useEffect(() => {
    let live = true;
    void loadDiagnostics(url).then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [url]);
  if (data === undefined) {
    return (
      <div className="flex items-center gap-2 text-[0.875rem]" role="status">
        <Spinner /> Reading the versions…
      </div>
    );
  }
  const g = data?.gateway;
  return (
    <div className="flex flex-col gap-4">
      <dl className="m-0">
        <Row label="Product" value={productText(g?.productVersion)} />
        <Row
          label="App"
          value={
            data
              ? `${data.app.name} ${data.app.version} (${shortCommit(data.app.commit)})`
              : "unknown"
          }
        />
        {g?.box ? (
          <>
            <Row label="Base OS" value={g.box.baseOS} />
            <Row label="Base Web" value={g.box.baseWeb} />
            <Row label="Box" value={g.box.fqdn} />
          </>
        ) : (
          <Row label="Appliance" value={g?.appliance ?? "not appliance"} />
        )}
        {g && (
          <Row
            label="Gateway"
            value={`${g.gateway.version ?? "unknown"} (${shortCommit(g.gateway.commit ?? "unknown")})`}
          />
        )}
        {g && (
          <Row
            label="Signed in as"
            value={`${g.actor.username} (${g.actor.roles.join(", ") || "no roles"})`}
          />
        )}
      </dl>
      {g ? (
        <>
          <Section items={g.services.filter((c) => !isFeature(c))} title="Services" />
          <Section
            items={g.services.filter((c) => isFeature(c))}
            title="Controllable features"
            value={featureOf}
          />
          <Section items={g.thirdParty.filter((c) => inUse(c))} title="Third party" />
        </>
      ) : (
        <p className="m-0 text-[0.875rem] text-muted">
          {"The gateway's versions couldn't be read."}
        </p>
      )}
      <div>
        <CopyDiagnostics variant="primary" />
      </div>
    </div>
  );
};

/** The account menu's About and diagnostics: every version, and a Copy diagnostics button. */
export const AboutDialog = ({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) => (
  <Dialog onOpenChange={onOpenChange} open={open}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>About and diagnostics</DialogTitle>
        <DialogDescription>
          The versions of this app and everything behind it. Copy them into a support request.
        </DialogDescription>
      </DialogHeader>
      {open && <DiagnosticsUrl>{(url) => <Body url={url} />}</DiagnosticsUrl>}
    </DialogContent>
  </Dialog>
);
