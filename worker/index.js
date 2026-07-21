export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      });
    }

    const target = url.searchParams.get("url");
    if (!target) {
      return new Response(JSON.stringify({ status: "ok", usage: "?url=<encoded yahoo url>" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    try {
      const decoded = decodeURIComponent(target);
      const upstream = await fetch(decoded, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Content-Type": upstream.headers.get("Content-Type") || "application/json",
        },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 502 });
    }
  },
};
