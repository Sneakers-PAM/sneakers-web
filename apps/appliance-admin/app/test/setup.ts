import { afterEach, vi } from "vitest";

import { setSession } from "@/lib/osadmin/sessionStore";
import { resetPhase } from "@/lib/phase";
import { resetMockWorld } from "@/mock/edge.mock";

vi.stubEnv("SNEAKERS_MOCK", "true");

afterEach(() => {
  // A spy one test puts on a client method must not reach the next test.
  vi.restoreAllMocks();
  resetMockWorld();
  resetPhase();
  setSession(null);
});
