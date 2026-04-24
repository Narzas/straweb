export default {
  async fetch(request) {
    const url = new URL(request.url);

    // fapi.binance.com 엔드포인트만 허용
    const allowed = [
      "/fapi/v1/ticker/24hr",
      "/fapi/v1/premiumIndex",
      "/fapi/v1/klines",
      "/futures/data/openInterestHist",
    ];
    if (!allowed.some((p) => url.pathname.startsWith(p))) {
      return new Response("Not allowed", { status: 403 });
    }

    const target = `https://fapi.binance.com${url.pathname}${url.search}`;
    try {
      const res = await fetch(target, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10_000),
      });
      return new Response(res.body, {
        status: res.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 502, headers: { "Content-Type": "application/json" } });
    }
  },
};
