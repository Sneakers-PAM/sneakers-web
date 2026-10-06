import { cn } from "#ui/lib/cn";

/** A data table in a card. Head cells use the label style on a sunken band. */
export const Table = ({ className, ...props }: React.ComponentProps<"table">) => {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-left text-body", className)} {...props} />
    </div>
  );
};

export const TableBody = ({
  className,
  striped,
  ...props
}: { striped?: boolean } & React.ComponentProps<"tbody">) => {
  return (
    <tbody className={cn(striped && "[&>tr:nth-child(even)]:bg-sunken/50", className)} {...props} />
  );
};

export const TableCell = ({ className, ...props }: React.ComponentProps<"td">) => {
  return <td className={cn("px-4.5 py-3.25 align-middle", className)} {...props} />;
};

export const TableHead = ({ className, ...props }: React.ComponentProps<"thead">) => {
  return <thead className={cn("bg-sunken", className)} {...props} />;
};

export const TableHeaderCell = ({ className, ...props }: React.ComponentProps<"th">) => {
  return (
    <th
      className={cn(
        "px-4.5 py-3 font-mono text-label font-bold tracking-[0.06em] text-muted uppercase",
        className,
      )}
      scope="col"
      {...props}
    />
  );
};

export const TableRow = ({
  className,
  selected,
  ...props
}: { selected?: boolean } & React.ComponentProps<"tr">) => {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        "border-t border-border transition-colors duration-[120ms] hover:bg-sunken",
        selected && "bg-primary-soft hover:bg-primary-soft",
        className,
      )}
      {...props}
    />
  );
};
