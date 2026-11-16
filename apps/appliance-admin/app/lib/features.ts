/**
 * Whether the Logs page offers "Download logs". Off until the box serves `GET /export/logs`;
 * set VITE_LOGS_DOWNLOAD=true to turn it back on. Read on each call so a test can stub it.
 */
export const logsDownloadEnabled = (): boolean => import.meta.env.VITE_LOGS_DOWNLOAD === "true";
