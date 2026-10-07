import { DropdownMenuItem, useDisplay } from "@sneakers-web/ui";
import { useMatches, useParams } from "react-router";

import { copyIssueBundleWithNotice } from "#shell/issueCopy/copy";
import { issuePath } from "#shell/issueCopy/path";

/**
 * Rendered on the mounted item, so the live-build check (scripts/check-no-mock.mjs) has a tell
 * that can't be tree-shaken away while the item exists, and so the click capture can skip it.
 */
export const ISSUE_COPY_MARKER = "sneakers-ui-issue-copy-v1";

const cleanParameters = (
  parameters: Readonly<Record<string, string | undefined>>,
): Record<string, string> =>
  Object.fromEntries(
    Object.entries(parameters).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );

/**
 * Dev builds only: copies a compact, machine-readable bundle describing the current screen
 * (schema v1), for pasting into an issue or a chat. Mirrors the dev quick login's two
 * switches: the build flag is a literal, so a release build drops this whole item, and
 * `check:no-mock` proves a live build has none of it. `developmentUiIssueCopy` is the
 * server's half of the gate, read once from the root loader by the caller.
 */
export const IssueCopyMenuItem = ({
  app,
  developmentUiIssueCopy,
  role,
}: {
  app: string;
  developmentUiIssueCopy: boolean;
  role: string;
}) => {
  const matches = useMatches();
  const parameters = cleanParameters(useParams());
  const { settings } = useDisplay();
  if (import.meta.env.SNEAKERS_DEV_UI_ISSUE_COPY_BUILD !== "true" || !developmentUiIssueCopy) {
    return null;
  }
  const last = matches.at(-1);
  return (
    <DropdownMenuItem
      data-issue-copy={ISSUE_COPY_MARKER}
      onSelect={() =>
        void copyIssueBundleWithNotice({
          app,
          params: parameters,
          path: issuePath(last?.pathname, parameters),
          role,
          route: last?.id,
          theme: settings.theme,
        })
      }
    >
      Copy for UI issue
      <span className="ml-auto font-mono text-[0.75rem] font-bold text-muted">DEV</span>
    </DropdownMenuItem>
  );
};
