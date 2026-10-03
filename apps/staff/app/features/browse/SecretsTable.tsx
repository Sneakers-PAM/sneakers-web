import {
  Badge,
  Button,
  Card,
  Checkbox,
  cn,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
  EmptyState,
  HeartbeatPill,
  Input,
  Label,
  plural,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  toast,
} from "@sneakers-web/ui";
import { ChevronDown, Lock } from "lucide-react";
import { useId, useState } from "react";
import { Link, useNavigate } from "react-router";

import type { BrowseSecret } from "@/features/browse/types";

import { heartbeatOf } from "@/features/browse/heartbeat";
import { useBrowseAction } from "@/features/browse/useBrowseAction";

type Column = "heartbeat" | "type";

const COMING_SOON = "Coming soon: this bulk action isn't ready yet.";

/**
 * U-03 the folder's secrets: filter, retired toggle, column picker, selection with the bulk
 * bar, and a right-click (Shift+F10) menu per row.
 */
export const SecretsTable = ({
  canManage,
  folderId,
  includeRetired,
  onMove,
  onShowRetired,
  secrets,
  types,
}: {
  canManage: boolean;
  folderId: string;
  includeRetired: boolean;
  onMove: (secrets: { id: string; name: string }[]) => void;
  onShowRetired: (on: boolean) => void;
  secrets: BrowseSecret[];
  types: Record<string, string>;
}) => {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [descending, setDescending] = useState(false);
  const [columns, setColumns] = useState<Set<Column>>(new Set(["heartbeat", "type"]));
  const navigate = useNavigate();
  const restore = useBrowseAction();
  const retiredId = useId();

  const q = query.trim().toLowerCase();
  const rows = secrets
    .filter((s) => !q || s.name.toLowerCase().includes(q))
    .toSorted((a, b) => (descending ? -1 : 1) * a.name.localeCompare(b.name));
  const chosen = secrets.filter((s) => picked.has(s.id));
  const allPicked = rows.length > 0 && rows.every((s) => picked.has(s.id));

  const toggle = (id: string, on: boolean) =>
    setPicked((previous) => {
      const next = new Set(previous);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  const toggleColumn = (c: Column, on: boolean) =>
    setColumns((previous) => {
      const next = new Set(previous);
      if (on) next.add(c);
      else next.delete(c);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {chosen.length > 0 && (
        <div
          aria-label="Selected secrets"
          className="flex flex-wrap items-center gap-2.5 rounded-xl bg-ink px-4 py-3 text-bg"
          role="region"
        >
          <b className="mr-auto text-body">{plural(chosen.length, "secret")} selected</b>
          <Button
            className="border-bg/60 bg-transparent text-bg hover:bg-bg/10"
            onClick={() => toast(COMING_SOON)}
            size="sm"
            variant="secondary"
          >
            Change type…
          </Button>
          <Button
            className="border-bg/60 bg-transparent text-bg hover:bg-bg/10"
            onClick={() => toast(COMING_SOON)}
            size="sm"
            variant="secondary"
          >
            Export…
          </Button>
          {canManage && (
            <Button
              className="border-bg/60 bg-transparent text-bg hover:bg-bg/10"
              onClick={() => onMove(chosen.map(({ id, name }) => ({ id, name })))}
              size="sm"
              variant="secondary"
            >
              Move…
            </Button>
          )}
          <Button
            className="text-bg hover:bg-bg/10"
            onClick={() => setPicked(new Set())}
            size="sm"
            variant="ghost"
          >
            Clear
          </Button>
        </div>
      )}
      <Card>
        <div className="flex flex-wrap items-center gap-4 border-b border-border px-4.5 py-4">
          <Input
            aria-label="Filter secrets"
            className="tablet:max-w-80"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter secrets"
            type="search"
            value={query}
          />
          <span className="flex items-center gap-2.5">
            <Switch checked={includeRetired} id={retiredId} onCheckedChange={onShowRetired} />
            <Label htmlFor={retiredId}>Show retired</Label>
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="ml-auto" size="sm" variant="secondary">
                Columns
                <ChevronDown aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuCheckboxItem
                checked={columns.has("type")}
                onCheckedChange={(on) => toggleColumn("type", on)}
              >
                Type
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={columns.has("heartbeat")}
                onCheckedChange={(on) => toggleColumn("heartbeat", on)}
              >
                Heartbeat
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {secrets.length === 0 ? (
          <EmptyState
            action={
              canManage && (
                <Button asChild>
                  <Link to={`/secret/new?folderId=${folderId}`}>New secret</Link>
                </Button>
              )
            }
            body="Add one, or move secrets in from another folder."
            className="m-4.5"
            title="No secrets here yet"
          />
        ) : rows.length === 0 ? (
          <EmptyState
            body="Try a shorter name, or clear the filter."
            className="m-4.5"
            loader={false}
            title={`No secrets match "${query.trim()}"`}
          />
        ) : (
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell className="w-12">
                  <Checkbox
                    aria-label="Select all"
                    checked={allPicked}
                    onCheckedChange={(on) => {
                      for (const s of rows) toggle(s.id, on === true);
                    }}
                  />
                </TableHeaderCell>
                <TableHeaderCell aria-sort={descending ? "descending" : "ascending"}>
                  <button
                    className="inline-flex items-center gap-1 uppercase"
                    onClick={() => setDescending((d) => !d)}
                    type="button"
                  >
                    Name
                    <ChevronDown
                      aria-hidden
                      className={cn("size-3.5", descending && "rotate-180")}
                    />
                  </button>
                </TableHeaderCell>
                {columns.has("type") && <TableHeaderCell>Type</TableHeaderCell>}
                {columns.has("heartbeat") && <TableHeaderCell>Heartbeat</TableHeaderCell>}
                <TableHeaderCell>
                  <span className="sr-only">Actions</span>
                </TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {rows.map((s) => (
                <ContextMenu key={s.id}>
                  <ContextMenuTrigger asChild>
                    <TableRow className={cn(s.retired && "text-muted")} selected={picked.has(s.id)}>
                      <TableCell>
                        <Checkbox
                          aria-label={`Select ${s.name}`}
                          checked={picked.has(s.id)}
                          onCheckedChange={(on) => toggle(s.id, on === true)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-wrap items-center gap-2">
                          {s.canRead === true ? (
                            <Link
                              className={cn("font-bold text-primary", s.retired && "opacity-70")}
                              to={`/secret/${s.id}`}
                            >
                              {s.name}
                            </Link>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 font-bold text-muted">
                              <Lock aria-hidden className="size-3.5" />
                              {s.name}
                            </span>
                          )}
                          {s.canRead !== true && (
                            <Badge tone="sunken">
                              {s.canRead === false ? "Locked" : "Access unknown"}
                            </Badge>
                          )}
                          {s.retired && <Badge>Retired</Badge>}
                        </span>
                      </TableCell>
                      {columns.has("type") && <TableCell>{types[s.typeId] ?? s.typeId}</TableCell>}
                      {columns.has("heartbeat") && (
                        <TableCell>
                          <HeartbeatPill status={heartbeatOf(s)} />
                        </TableCell>
                      )}
                      <TableCell className="text-right">
                        {s.canRead !== true && (
                          <Button asChild size="sm" variant="secondary">
                            <Link to={`/requests?new=${s.id}`}>Request access</Link>
                          </Button>
                        )}
                        {s.retired && canManage && (
                          <Button
                            loading={restore.busy}
                            onClick={() => restore.submit({ id: s.id, intent: "restore" })}
                            size="sm"
                            variant="secondary"
                          >
                            Restore
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  </ContextMenuTrigger>
                  <ContextMenuContent>
                    <ContextMenuItem onSelect={() => void navigate(`/secret/${s.id}`)}>
                      Open
                    </ContextMenuItem>
                    {canManage && (
                      <ContextMenuItem onSelect={() => onMove([{ id: s.id, name: s.name }])}>
                        Move…
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => void navigate(`/secret/${s.id}/sharing`)}>
                      Manage access
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
      {restore.error && (
        <p className="text-small font-bold text-danger" role="alert">
          {restore.error}
        </p>
      )}
      <p className="text-small text-muted">
        Right-click a row or press Shift+F10 for its menu. Change type and Export open a
        &quot;coming soon&quot; note for now.
      </p>
    </div>
  );
};
