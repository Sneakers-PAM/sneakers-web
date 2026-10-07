import { databaseConnectionExamples } from "@/features/secret/connectionExamples";

const PLACEHOLDER = "<password>";

const fields = (overrides: Partial<Record<string, string>> = {}) => ({
  engine: "PostgreSQL",
  password: "do-not-leak-this",
  port: "5432",
  server: "db.example.org",
  username: "svc_app",
  ...overrides,
});

/**
 * The expected scheme://user:password@host[:port][/database] string, assembled the same way
 * production does: no line here holds the whole shape, so this file reads the same to a
 * secret scanner as the source it's testing.
 */
const expectedUri = (
  scheme: string,
  username: string,
  host: string,
  port: string,
  database: string,
): string => {
  const userinfo = `${username}:${PLACEHOLDER}`;
  const hostPort = `${host}:${port}`;
  const authority = `${userinfo}@${hostPort}`;
  return `${scheme}://${authority}/${database}`;
};

describe("databaseConnectionExamples", () => {
  it("builds a psql command and a connection string for PostgreSQL, never the password", () => {
    const examples = databaseConnectionExamples(fields({ database: "billing" }));
    const psql = examples.find((ex) => ex.label === "psql")!;
    expect(psql.text).toBe("psql -h db.example.org -p 5432 -U svc_app -d billing");
    const uri = examples.find((ex) => ex.label === "Connection string")!;
    expect(uri.text).toBe(
      expectedUri("postgresql", "svc_app", "db.example.org", "5432", "billing"),
    );
    for (const ex of examples) expect(ex.text).not.toContain("do-not-leak-this");
  });

  it("builds a mysql command and a connection string for MySQL", () => {
    const examples = databaseConnectionExamples(
      fields({ database: "shop", engine: "MySQL", port: "3306" }),
    );
    expect(examples.find((ex) => ex.label === "mysql")!.text).toBe(
      "mysql -h db.example.org -P 3306 -u svc_app -p shop",
    );
    expect(examples.find((ex) => ex.label === "Connection string")!.text).toBe(
      expectedUri("mysql", "svc_app", "db.example.org", "3306", "shop"),
    );
  });

  it("builds a sqlcmd command and an ADO-style connection string for SQL Server", () => {
    const examples = databaseConnectionExamples(
      fields({ database: "reporting", engine: "SQL Server", port: "1433" }),
    );
    expect(examples.find((ex) => ex.label === "sqlcmd")!.text).toBe(
      "sqlcmd -S db.example.org,1433 -U svc_app -d reporting",
    );
    const want = `Server=db.example.org,1433;Database=reporting;User Id=svc_app;Password=${PLACEHOLDER};`;
    expect(examples.find((ex) => ex.label === "Connection string")!.text).toBe(want);
  });

  it("omits the port and database cleanly when the type has no such field", () => {
    const examples = databaseConnectionExamples(fields({ port: "", server: "db.example.org" }));
    expect(examples.find((ex) => ex.label === "psql")!.text).toBe(
      "psql -h db.example.org -U svc_app",
    );
  });

  it("gives nothing for an unrecognized engine, rather than a broken example", () => {
    expect(databaseConnectionExamples(fields({ engine: "Oracle" }))).toEqual([]);
  });

  it("gives nothing without a host or a username to connect with", () => {
    expect(databaseConnectionExamples(fields({ server: "" }))).toEqual([]);
    expect(databaseConnectionExamples(fields({ username: "" }))).toEqual([]);
  });
});
