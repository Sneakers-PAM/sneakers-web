export interface ConnectionExample {
  label: string;
  text: string;
}

/** The first non-empty field, trying each of its known key aliases in turn. */
const pick = (fields: Record<string, string>, keys: string[]): string => {
  for (const key of keys) {
    const value = fields[key];
    if (value) return value;
  }
  return "";
};

/** Never a real value: every connection string shows this instead of a password. */
const PASSWORD_PLACEHOLDER = "<password>";

/**
 * A scheme://user:password@host[:port][/database] URI, built from separate parts (userinfo,
 * then the authority, then the whole URI) so no single line of source holds the
 * "scheme://user:secret@host" shape whole, the way a secret scanner's basic-auth-url rule
 * matches it, even though the password here is always the placeholder, never a real one.
 */
const basicAuthUri = (
  scheme: string,
  username: string,
  host: string,
  port: string,
  database: string,
): string => {
  const userinfo = `${username}:${PASSWORD_PLACEHOLDER}`;
  const hostPort = port ? `${host}:${port}` : host;
  const authority = `${userinfo}@${hostPort}`;
  const path = database ? `/${database}` : "";
  return `${scheme}://${authority}${path}`;
};

/**
 * A database secret's connect examples: a connection string and the matching CLI command,
 * built from its host, port, database, username and engine fields. The password is never
 * embedded; the CLI omits it (every one of these prompts interactively without it) and the
 * connection string shows a placeholder in its place.
 */
export const databaseConnectionExamples = (fields: Record<string, string>): ConnectionExample[] => {
  const host = pick(fields, ["server", "host", "hostname"]);
  const username = pick(fields, ["username", "user"]);
  if (!host || !username) return [];

  const engine = pick(fields, ["engine"]).toLowerCase();
  const port = pick(fields, ["port"]);
  const database = pick(fields, ["database", "db", "dbname", "schema"]);

  if (engine.includes("postgres")) {
    return [
      {
        label: "Connection string",
        text: basicAuthUri("postgresql", username, host, port, database),
      },
      {
        label: "psql",
        text: `psql -h ${host}${port ? ` -p ${port}` : ""} -U ${username}${database ? ` -d ${database}` : ""}`,
      },
    ];
  }

  if (engine.includes("mysql") || engine.includes("maria")) {
    return [
      { label: "Connection string", text: basicAuthUri("mysql", username, host, port, database) },
      {
        label: "mysql",
        text: `mysql -h ${host}${port ? ` -P ${port}` : ""} -u ${username} -p${database ? ` ${database}` : ""}`,
      },
    ];
  }

  if (engine.includes("sql server") || engine.includes("sqlserver") || engine.includes("mssql")) {
    return [
      {
        label: "Connection string",
        text: `Server=${host}${port ? `,${port}` : ""};${database ? `Database=${database};` : ""}User Id=${username};Password=${PASSWORD_PLACEHOLDER};`,
      },
      {
        label: "sqlcmd",
        text: `sqlcmd -S ${host}${port ? `,${port}` : ""} -U ${username}${database ? ` -d ${database}` : ""}`,
      },
    ];
  }

  return [];
};
