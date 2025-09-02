export const onRequestGet: PagesFunction = async () =>
  new Response(JSON.stringify({ ok: true, where: "Pages Functions" }), {
    headers: { "content-type": "application/json" },
  });
