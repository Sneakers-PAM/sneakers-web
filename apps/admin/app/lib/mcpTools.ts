/**
 * The MCP server's tools, by the names it registers (sneakers-mcp, internal/tools). The setting
 * takes any non-empty name, so the page offers only these, plus any other name already switched
 * off so it can be switched back on.
 */
export const MCP_TOOLS: readonly { description: string; name: string }[] = [
  { description: "Searches for secrets by name.", name: "sneakers_find_secrets" },
  { description: "Reads a secret's details.", name: "sneakers_get_secret" },
  { description: "Creates a secret.", name: "sneakers_create_secret" },
  { description: "Creates a secret with a generated value.", name: "sneakers_generate_secret" },
  { description: "Changes a secret's values.", name: "sneakers_update_secret" },
  { description: "Renames a secret.", name: "sneakers_rename_secret" },
  { description: "Moves a secret to another folder.", name: "sneakers_move_secret" },
  { description: "Changes a secret's type.", name: "sneakers_change_secret_type" },
  { description: "Rotates a secret's value on its target.", name: "sneakers_rotate_secret" },
  { description: "Checks that a secret still works on its target.", name: "sneakers_test_secret" },
  {
    description: "Restores an earlier version of a secret.",
    name: "sneakers_restore_secret_version",
  },
  {
    description: "Redeems an approved reveal of a sensitive field.",
    name: "sneakers_redeem_reveal",
  },
  { description: "Generates an SSH key.", name: "sneakers_generate_ssh_key" },
  {
    description: "Turns a secret's rotation and heartbeat on or off.",
    name: "sneakers_set_secret_automation",
  },
  { description: "Lists folders.", name: "sneakers_list_folders" },
  { description: "Creates a folder.", name: "sneakers_create_folder" },
  { description: "Renames a folder.", name: "sneakers_rename_folder" },
  { description: "Lists secret types.", name: "sneakers_list_secret_types" },
  { description: "Lists extension packs.", name: "sneakers_list_extension_packs" },
  { description: "Imports an extension pack.", name: "sneakers_import_extension_pack" },
  { description: "Lists connections.", name: "sneakers_list_connections" },
  { description: "Lists targets.", name: "sneakers_list_targets" },
  { description: "Creates or changes a target.", name: "sneakers_save_target" },
  { description: "Attaches a target to a secret.", name: "sneakers_attach_secret_target" },
  { description: "Detaches a target from a secret.", name: "sneakers_detach_secret_target" },
  { description: "Sets a secret's main target.", name: "sneakers_set_secret_target" },
];

/** The list after one tool is switched on or off: the others untouched, no repeats. */
export const withTool = (disabled: readonly string[], name: string, on: boolean): string[] => {
  const rest = disabled.filter((n) => n !== name);
  return on ? rest : [...rest, name];
};
