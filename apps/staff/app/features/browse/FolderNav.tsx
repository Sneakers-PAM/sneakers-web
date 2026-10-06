import {
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@sneakers-web/ui";
import { Circle, Play } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router";

import { type FolderAction, folderActions } from "@/features/browse/folderActions";
import { childrenOf, isPersonal, type NavFolder } from "@/features/browse/tree";

interface RowContext {
  currentId?: string;
  folders: NavFolder[];
  onAction: (action: FolderAction, folder: NavFolder) => void;
}

const sectionLabel =
  "px-3 pt-4 pb-1.5 font-mono text-label font-bold tracking-[0.08em] text-muted uppercase";

const Row = ({ ctx, depth, folder }: { ctx: RowContext; depth: number; folder: NavFolder }) => {
  const selected = folder.id === ctx.currentId;
  const items = folderActions(ctx.folders, folder);
  const Icon = isPersonal(folder) && depth === 0 ? Circle : Play;
  return (
    <li>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex min-h-10 min-w-0 items-center gap-2.5 rounded-md border-l-3 border-transparent px-3 text-body font-bold text-ink transition-colors duration-[120ms] hover:bg-sunken",
              selected && "border-l-primary bg-primary-soft hover:bg-primary-soft",
            )}
            style={depth ? { paddingLeft: `${0.75 + depth * 1}rem` } : undefined}
            title={folder.name}
            to={`/browse/${folder.id}`}
          >
            <Icon aria-hidden className="size-2 shrink-0 text-muted" fill="currentColor" />
            <span className="min-w-0 flex-1 truncate">{folder.name}</span>
            {folder.subtreeSecretCount !== null && (
              <span className="font-mono text-small text-muted">{folder.subtreeSecretCount}</span>
            )}
          </Link>
        </ContextMenuTrigger>
        <ContextMenuContent>
          {items.map((item) => (
            <Fragment key={item.action}>
              {item.split && <ContextMenuSeparator />}
              <ContextMenuItem onSelect={() => ctx.onAction(item.action, folder)} tone={item.tone}>
                {item.label}
              </ContextMenuItem>
            </Fragment>
          ))}
        </ContextMenuContent>
      </ContextMenu>
    </li>
  );
};

/** Every folder under `parentId` that passes `filter`, each followed by its own children. */
const Branch = ({
  ctx,
  depth,
  filter,
  parentId,
}: {
  ctx: RowContext;
  depth: number;
  filter: (f: NavFolder) => boolean;
  parentId: null | string;
}) => {
  const rows = childrenOf(ctx.folders, parentId).filter((f) => filter(f));
  return rows.map((f) => (
    <Fragment key={f.id}>
      <Row ctx={ctx} depth={depth} folder={f} />
      <Branch ctx={ctx} depth={depth + 1} filter={filter} parentId={f.id} />
    </Fragment>
  ));
};

/**
 * The folder navigator (U-03): personal folders pinned at the top, shared folders beneath as a
 * parent/child tree, fully expanded. Right-click (or Shift+F10) a folder for its menu.
 */
export const FolderNav = ({ className, ...context }: { className?: string } & RowContext) => {
  const { folders } = context;
  const hasPersonal = folders.some((f) => isPersonal(f));
  const hasShared = folders.some((f) => !isPersonal(f));

  return (
    <nav aria-label="Folders" className={cn("flex flex-col", className)}>
      {hasPersonal && (
        <>
          <h2 className={sectionLabel}>Personal</h2>
          <ul className="flex flex-col gap-0.5">
            <Branch ctx={context} depth={0} filter={isPersonal} parentId={null} />
          </ul>
        </>
      )}
      <h2 className={sectionLabel}>Shared</h2>
      {hasShared ? (
        <ul className="flex flex-col gap-0.5">
          <Branch ctx={context} depth={0} filter={(f) => !isPersonal(f)} parentId={null} />
        </ul>
      ) : (
        <p className="px-3 py-3 text-small text-muted">No shared folders yet.</p>
      )}
    </nav>
  );
};
