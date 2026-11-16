// @vitest-environment node
import { loader } from "@/routes/s.link";

const open = (id: string) => loader({ params: { id } } as Parameters<typeof loader>[0]);

describe("the /s/<id> secret link", () => {
  it("sends the link to the secret's own page, where sign-in and access are decided", () => {
    const response = open("mock-secret-db-admin");
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/secret/mock-secret-db-admin");
  });

  it("keeps an id with reserved characters in one path segment", () => {
    expect(open("a/b?c").headers.get("Location")).toBe("/secret/a%2Fb%3Fc");
  });

  it("sends a link without an id to the secrets list", () => {
    expect(open("").headers.get("Location")).toBe("/secrets");
  });
});
