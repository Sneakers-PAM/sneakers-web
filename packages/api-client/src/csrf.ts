let token = "";

export const clearCsrf = (): void => {
  token = "";
};

/** The CSRF token for this session. It lives in memory only and is sent back on every call. */
export const getCsrf = (): string => {
  return token;
};

export const setCsrf = (next: string): void => {
  token = next;
};
