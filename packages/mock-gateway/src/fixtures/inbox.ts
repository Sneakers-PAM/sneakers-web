export interface MockNotification {
  action: string;
  actorLabel: string;
  id: string;
  occurredAt: string;
  read: boolean;
  resourceId: string;
  resourceKind: "folder" | "secret";
  resourceLabel: string;
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const initialInbox = (): MockNotification[] => {
  return [
    {
      action: "revealed",
      actorLabel: "Bob",
      id: "mock-note-1",
      occurredAt: ago(5),
      read: false,
      resourceId: "mock-secret-db-admin",
      resourceKind: "secret",
      resourceLabel: "DB admin",
    },
    {
      action: "shared",
      actorLabel: "Carol",
      id: "mock-note-2",
      occurredAt: ago(60),
      read: false,
      resourceId: "mock-folder-databases",
      resourceKind: "folder",
      resourceLabel: "Platform / Databases",
    },
    {
      action: "approved your request for",
      actorLabel: "Bob",
      id: "mock-note-3",
      occurredAt: ago(60 * 24),
      read: false,
      resourceId: "mock-secret-payroll",
      resourceKind: "secret",
      resourceLabel: "Payroll portal",
    },
    {
      action: "checked in",
      actorLabel: "Dave",
      id: "mock-note-4",
      occurredAt: ago(60 * 48),
      read: true,
      resourceId: "mock-secret-acme-vpn",
      resourceKind: "secret",
      resourceLabel: "Acme VPN",
    },
  ];
};
