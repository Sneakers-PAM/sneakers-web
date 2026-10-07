import { AccessScreen } from "@/components/ErrorScreens";

export default function Unauthorized() {
  return <AccessScreen status={401} />;
}
