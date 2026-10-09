import { Button, Card, CardHeader } from "@sneakers-web/ui";
import { useEffect, useState } from "react";

import type { ExposedValue, ListExposedValuesResponse } from "@/lib/osadmin/types";

import { CopyLine } from "@/features/access/CopyLine";
import { runAction } from "@/lib/osadmin/action";
import { product } from "@/lib/osadmin/client";

/**
 * The values the installed product's bundle lets this admin's role read without a root shell,
 * such as Sneakers' one-time setup token. Each is read only on Show (the box audits every read,
 * by name), and a one-time value once used says so instead. Nothing shows with no product, no
 * declared value, or a box from before ProductService.
 */
export const ProductValues = () => {
  const [data, setData] = useState<ListExposedValuesResponse>();
  useEffect(() => {
    void product
      .listExposedValues()
      .then(setData)
      .catch(() => setData(undefined));
  }, []);
  if (!data?.productTitle || data.values.length === 0) return null;
  return (
    <section aria-label="Product values">
      <Card>
        <CardHeader
          subtitle={`What ${data.productTitle} lets you read here, without the root shell.`}
          title="Product values"
        />
        <ul className="m-0 flex list-none flex-col divide-y divide-border p-0">
          {data.values.map((value) => (
            <ValueRow key={value.name} productTitle={data.productTitle} value={value} />
          ))}
        </ul>
      </Card>
    </section>
  );
};

const ValueRow = ({ productTitle, value }: { productTitle: string; value: ExposedValue }) => {
  const [entry, setEntry] = useState(value);
  const [shown, setShown] = useState("");
  const label = entry.label || entry.name;
  const show = () =>
    void runAction(() => product.getExposedValue(entry.name), {
      onSuccess: (response) => {
        if (response.entry) setEntry(response.entry);
        setShown(response.value);
      },
    });
  return (
    <li className="flex flex-col gap-2 px-5.5 py-4 text-small">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-bold">{label}</span>
        {!entry.consumed &&
          (shown ? (
            <Button onClick={() => setShown("")} size="sm" variant="secondary">
              Hide
            </Button>
          ) : (
            <Button aria-label={`Show ${label}`} onClick={show} size="sm" variant="secondary">
              Show
            </Button>
          ))}
      </div>
      {entry.consumed ? (
        <p className="m-0 text-muted">
          {productTitle} is already set up, so this one-time value was used and isn&apos;t shown
          again.
        </p>
      ) : (
        <>
          {shown && <CopyLine copied={`${label} copied.`} label={`Copy ${label}`} value={shown} />}
          {shown && entry.link && (
            <p className="m-0">
              Use it at{" "}
              <a className="font-mono break-all underline" href={entry.link}>
                {entry.link}
              </a>
              .
            </p>
          )}
          {entry.oneTime && (
            <p className="m-0 text-muted">
              One time: once {productTitle} is set up with it, the box doesn&apos;t show it again.
              Each Show is recorded in the audit log.
            </p>
          )}
        </>
      )}
    </li>
  );
};
