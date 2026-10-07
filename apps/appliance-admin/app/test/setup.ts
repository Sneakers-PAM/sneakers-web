import { afterEach, vi } from "vitest";

import { setSession } from "@/lib/osadmin/sessionStore";
import { resetMockWorld } from "@/mock/edge.mock";

vi.stubEnv("SNEAKERS_MOCK", "true");

afterEach(() => {
  resetMockWorld();
  setSession(null);
});
