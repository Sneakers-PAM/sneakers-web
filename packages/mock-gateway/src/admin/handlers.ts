import { settingsHandlers } from "#mock/admin/settings";
import { typeHandlers } from "#mock/admin/types";
import { userHandlers } from "#mock/admin/users";

/** Every admin-console operation the mock gateway answers. */
export const adminHandlers = [...userHandlers, ...settingsHandlers, ...typeHandlers];
