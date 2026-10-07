import { NotAvailable } from "@/components/NotAvailable";

// Upload, mirror fetch, verify-before-unpack, stage/apply/revert and the air-gap behaviour
// are a follow-up PR (the security flows wave). This route is a placeholder until then.
export default function Updates() {
  return (
    <div className="p-5.5">
      <NotAvailable name="Updates" />
    </div>
  );
}
