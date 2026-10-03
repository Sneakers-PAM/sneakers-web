/*
 * Readable names for the audit action codes the services write. A code not listed here is
 * spelled out from its parts, so a new action still reads sensibly until it gets a label.
 */
const LABELS: Record<string, string> = {
  "api_token.mint": "API token minted",
  "api_token.revoke": "API token revoked",
  "api_token.use": "API token used",
  "auth.password_reset": "Password reset",
  "auth.signin": "Signed in",
  "checkout.denied": "Checkout refused",
  "connection.delete": "Connection deleted",
  "connection.save": "Connection saved",
  "extension.import": "Extension imported",
  "folder.create": "Folder created",
  "folder.delete": "Folder deleted",
  "folder.move": "Folder moved",
  "folder.rename": "Folder renamed",
  "folder.reveal_step_up.set": "Folder step-up changed",
  "folder.ruleset.set": "Folder sharing updated",
  "group.create": "Group created",
  "group.member.add": "Group member added",
  "group.member.remove": "Group member removed",
  "heartbeat.report": "Heartbeat check",
  "kek.rotate": "Key-encryption key rotated",
  "mfa.enroll": "MFA set up",
  "mfa.remove": "MFA removed",
  "mfa.verify": "MFA verified",
  "policy.delete": "Password policy deleted",
  "policy.save": "Password policy saved",
  "request.approve": "Access request approved",
  "request.create": "Access requested",
  "request.deny": "Access request denied",
  "role.recovery.grant": "Recovery role granted",
  "role.recovery.revoke": "Recovery role removed",
  "rotate.enqueue": "Rotation queued",
  "secret.break_glass": "Break-glass reveal",
  "secret.copy": "Password copied",
  "secret.create": "Secret created",
  "secret.delete": "Secret deleted",
  "secret.heartbeat.drift": "Heartbeat drift",
  "secret.heartbeat.unreachable": "Heartbeat unreachable",
  "secret.move": "Secret moved",
  "secret.read": "Secret viewed",
  "secret.restore": "Secret restored",
  "secret.retire": "Secret retired",
  "secret.reveal": "Secret revealed",
  "secret.reveal.denied": "Reveal refused",
  "secret.rotation.degraded": "Rotation degraded",
  "secret.rotation.failed": "Rotation failed",
  "secret.ruleset.set": "Secret sharing updated",
  "secret.update": "Secret edited",
  "secret.use.approve": "Agent use approved",
  "secret.use.deny": "Agent use denied",
  "secret.version.restore": "Prior version restored",
  "secret.version.reveal": "Prior value revealed",
  "secret_type.create": "Secret type created",
  "secret_type.delete": "Secret type deleted",
  "secret_type.update": "Secret type updated",
  "service_account.create": "Service account created",
  "service_account.disable": "Service account disabled",
  "service_account.oidc.link": "OIDC client linked",
  "service_account.oidc.unlink": "OIDC client unlinked",
  "settings.update": "Security settings updated",
  "target.delete": "Target deleted",
  "target.host_keys.change": "Target host keys changed",
  "target.save": "Target saved",
  "use_grant.create": "Use grant created",
  "use_grant.revoke": "Use grant revoked",
  "user.create": "User created",
  "user.disable": "User disabled",
  "user.enable": "User enabled",
  "user.roles.set": "User roles changed",
  "user.update": "User updated",
  "user_token.mint": "Personal token created",
  "user_token.revoke": "Personal token revoked",
  "workload.call_refused": "Service call refused",
};

const spell = (code: string) => {
  const words = code.replaceAll(/[._]/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** The readable name for an action. Actions a token or service account took say so. */
export const actionLabel = (action: string): string => {
  if (action.endsWith(".principal"))
    return `${actionLabel(action.slice(0, -".principal".length))} (by a token)`;
  return LABELS[action] ?? spell(action);
};

/** How loudly a row reads: danger for break-glass, failures and refusals; warn for drift. */
export const actionTone = (action: string): "danger" | "plain" | "warn" => {
  if (/break_glass|failed|denied|refused/.test(action)) return "danger";
  if (/drift|unreachable|degraded/.test(action)) return "warn";
  return "plain";
};
