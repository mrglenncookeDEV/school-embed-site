// Durable Object required by your project config
export class MyDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch() {
    return new Response("OK");
  }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1) API routes: handled by Worker (D1 etc)
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/message") {
        // TODO: Replace this with your real D1-backed logic
        return new Response(JSON.stringify({ message: "Hello from Worker API" }), {
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("Not found", { status: 404 });
    }

    // 2) Non-API: serve static assets from /public via Assets binding
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const assetResponse = await env.ASSETS.fetch(request);

      // If asset exists, return it with cache headers
      if (assetResponse.status !== 404) {
        const res = new Response(assetResponse.body, assetResponse);

        const path = url.pathname;

        // Hashed Vite assets: cache forever
        if (path.startsWith("/assets/")) {
          res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
        }
        // HTML: don’t cache hard (so new deploys show immediately)
        else if (path === "/" || path.endsWith(".html")) {
          res.headers.set("Cache-Control", "no-cache");
        }

        return res;
      }

      // If request looks like a file path (has a .), keep 404 (don’t SPA-fallback)
      const last = url.pathname.split("/").pop() || "";
      const looksLikeFile = last.includes(".");
      if (looksLikeFile) {
        return assetResponse;
      }

      // SPA fallback -> /index.html (also set no-cache)
      const fallbackUrl = new URL(request.url);
      fallbackUrl.pathname = "/index.html";

      const fallbackResponse = await env.ASSETS.fetch(new Request(fallbackUrl, request));
      const res = new Response(fallbackResponse.body, fallbackResponse);
      res.headers.set("Cache-Control", "no-cache");
      return res;
    }

    // 3) If ASSETS binding missing, fail clearly
    return new Response("Assets binding not configured (env.ASSETS missing).", {
      status: 500,
    });
  },
};
