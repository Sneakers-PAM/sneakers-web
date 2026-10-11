/**
 * How the installed product is removed: the closed shell's `sneakers reset` over SSH, never a
 * button here (sneakers-appliance docs/upgrades.md "Removing the product"). The Product card on
 * Updates shows it while a product is installed, and the Power page beside the factory reset.
 */
export const ProductResetNote = ({ onUpdates = false }: { onUpdates?: boolean }) => (
  <aside aria-label="Removing the product" className="text-muted" role="note">
    <p>
      {"To remove only the product and its data and keep the box, an owner runs "}
      <code>sneakers reset</code>
      {" over SSH ("}
      <code>{"ssh <owner>@<this box>"}</code>
      {
        "), with the product's name typed and a new authenticator code. It stops Sneakers-PAM, removes its database, users, secrets and setup, and keeps the box's admins, keys, certificates, network settings, Base OS and Base Web and the audit log. There's no undo and no button for it here. "
      }
      {onUpdates
        ? "Its bundle stays staged: Apply here installs it again, with a new setup token."
        : "Its bundle stays staged on Updates, where Apply installs it again."}
    </p>
  </aside>
);
