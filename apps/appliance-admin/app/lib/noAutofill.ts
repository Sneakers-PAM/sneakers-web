/**
 * Props that tell a browser or a password manager not to offer to fill or save a field.
 * `autoComplete` keeps the value browsers act on themselves ("off", or "new-password" on a
 * password field); the `data-*` attributes are what 1Password, Bitwarden and LastPass honour.
 */
export const noAutofill = (autoComplete = "off") => ({
  autoComplete,
  "data-1p-ignore": true,
  "data-bwignore": true,
  "data-form-type": "other",
  "data-lpignore": "true",
});
