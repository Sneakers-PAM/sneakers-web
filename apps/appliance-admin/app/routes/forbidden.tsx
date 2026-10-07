import { AccessScreen } from "@/components/ErrorScreens";

export default function Forbidden() {
  return <AccessScreen status={403} />;
}
