export const loader = () => {
  throw new Response("Not found", { status: 404 });
};

export { NotFoundScreen as default } from "@sneakers-web/shell";
