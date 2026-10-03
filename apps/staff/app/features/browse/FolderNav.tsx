import {
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@sneakers-web/ui";
import { ChevronLeft, ChevronRight, Circle, Play } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router";

import { type FolderAction, folderActions } from "@/features/browse/folderActions";
import { childrenOf, findFolder, isPersonal, type NavFolder } from "@/features/browse/tree";

interface RowContext {
  currentId?: string;
  folders: NavFolder[];
  onAction: (action: FolderAction, folder: NavFolder) => void;
}

const sectionLabel =
  "px-3 pt-4 pb-1.5 font-mono text-label font-bold tracking-[0.08em] text-muted uppercase";

/** The level the shared panel opens at: inside the open folder if it has subfolders, else its parent's. */
const levelFor = (folders: NavFolder[], current: NavFolder | undefined): null | string => {
  if (!current || isPersonal(current)) return null;
  return childrenOf(folders, current.id).length > 0 ? current.id : (current.parentId ?? null);
};

const Row = ({
  ctx,
  depth = 0,
  drill,
  folder,
}: {
  ctx: RowContext;
  depth?: number;
  drill?: () => void;
  folder: NavFolder;
}) => {
  const selected = folder.id === ctx.currentId;
  const items = folderActions(ctx.folders, folder);
  const Icon = isPersonal(folder) && depth === 0 ? Circle : Play;
  return (
    <li className="flex items-center gap-1">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Link
            aria-current={selected ? "page" : undefined}
            className={cn(
              "flex min-h-10 min-w-0 flex-1 items-center gap-2.5 rounded-md border-l-3 border-transparent px-3 text-body font-bold text-ink transition-colors duration-[120ms] hover:bg-sunken",
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
      {drill && (
        <button
          aria-label={`Open ${folder.name}'s folders`}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm text-muted hover:bg-sunken hover:text-ink"
          onClick={drill}
          type="button"
        >
          <ChevronRight aria-hidden className="size-4" />
        </button>
      )}
    </li>
  );
};

const PersonalTree = ({
  ctx,
  depth,
  parentId,
}: {
  ctx: RowContext;
  depth: number;
  parentId: null | string;
}) => {
  const rows = childrenOf(ctx.folders, parentId).filter(isPersonal);
  return rows.map((f) => (
    <Fragment key={f.id}>
      <Row ctx={ctx} depth={depth} folder={f} />
      <PersonalTree ctx={ctx} depth={depth + 1} parentId={f.id} />
    </Fragment>
  ));
};

/**
 * The folder navigator (U-03): personal folders pinned and fully open, shared folders one level
 * at a time so deep trees stay easy to scan. Right-click (or Shift+F10) a folder for its menu.
 */
export const FolderNav = ({ className, ...context }: { className?: string } & RowContext) => {
  const { currentId, folders } = context;
  const current = findFolder(folders, currentId);
  // The page keys this component by the open folder, so opening another one starts afresh.
  const [level, setLevel] = useState(() => levelFor(folders, current));

  const at = findFolder(folders, level);
  const shared = childrenOf(folders, at ? at.id : null).filter((f) => !isPersonal(f));
  const hasPersonal = folders.some((f) => isPersonal(f));

  return (
    <nav aria-label="Folders" className={cn("flex flex-col", className)}>
      {hasPersonal && (
        <>
          <h2 className={sectionLabel}>Personal</h2>
          <ul className="flex flex-col gap-0.5">
            <PersonalTree ctx={context} depth={0} parentId={null} />
          </ul>
        </>
      )}
      <h2 className={sectionLabel}>Shared</h2>
      {at && (
        <button
          aria-label={`Up from ${at.name}`}
          className="flex min-h-9 items-center gap-1 rounded-md px-3 text-left text-body font-bold text-primary hover:bg-primary-soft"
          onClick={() => setLevel(at.parentId ?? null)}
          type="button"
        >
          <ChevronLeft aria-hidden className="size-4" />
          {at.name}
        </button>
      )}
      {shared.length === 0 ? (
        <p className="px-3 py-3 text-small text-muted">No shared folders here.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {shared.map((f) => (
            <Row
              ctx={context}
              drill={childrenOf(folders, f.id).length > 0 ? () => setLevel(f.id) : undefined}
              folder={f}
              key={f.id}
            />
          ))}
        </ul>
      )}
    </nav>
  );
};
