import { auditHandlers } from "#mock/admin/audit";
import { serviceAccountHandlers } from "#mock/admin/serviceAccounts";
import { settingsHandlers } from "#mock/admin/settings";
import { targetHandlers } from "#mock/admin/targets";
import { typeHandlers } from "#mock/admin/types";
import { userHandlers } from "#mock/admin/users";

/** Every admin-console operation the mock gateway answers. */
export const adminHandlers = [
  ...userHandlers,
  ...settingsHandlers,
  ...typeHandlers,
  ...targetHandlers,
  ...serviceAccountHandlers,
  ...auditHandlers,
];
