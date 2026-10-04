import { agentsHandlers } from "#mock/handlers/staff/agents";
import { browseHandlers } from "#mock/handlers/staff/browse";
import { dashboardHandlers } from "#mock/handlers/staff/dashboard";
import { editorsHandlers } from "#mock/handlers/staff/editors";
import { movesHandlers } from "#mock/handlers/staff/moves";
import { requestsHandlers } from "#mock/handlers/staff/requests";
import { secretHandlers } from "#mock/handlers/staff/secret";
import { settingsHandlers } from "#mock/handlers/staff/settings";
import { sharingHandlers } from "#mock/handlers/staff/sharing";
import { targetsHandlers } from "#mock/handlers/staff/targets";

/** Every staff screen's mock answers, one module per area so the slices never share a file. */
export const staffHandlers = [
  ...dashboardHandlers,
  ...browseHandlers,
  ...secretHandlers,
  ...movesHandlers,
  ...requestsHandlers,
  ...agentsHandlers,
  ...editorsHandlers,
  ...targetsHandlers,
  ...sharingHandlers,
  ...settingsHandlers,
];
