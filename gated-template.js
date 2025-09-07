// netlify/functions/gated-template.js
// Template for gated platforms using OFFICIAL APIs only.
// Populate environment variables in Netlify UI before use.
// - X (Twitter) API: X_BEARER_TOKEN
// - Reddit API: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET (script app), REDDIT_USER, REDDIT_PASS
// - Instagram Basic Display: IG_ACCESS_TOKEN
// NO SUPPORT for paywalled platforms (e.g., OnlyFans/Fansly).

export async function handler(event) {
  const q = (event.queryStringParameters?.q || "").trim();
  const source = (event.queryStringParameters?.source || "").toLowerCase();
  try {
    if (!q || !source) return json({ error: "Provide ?source=twitter|reddit|instagram&q=..." }, 400);

    if (source === "twitter") {
      const token = process.env.X_BEARER_TOKEN;
      if (!token) return json({ error: "Missing X_BEARER_TOKEN" }, 400);
      // Example: search recent tweets with media
      const api = `https://api.x.com/2/tweets/search/recent?query=${encodeURIComponent(q)} has:images -is:retweet&expansions=attachments.media_keys&media.fields=url,preview_image_url`;
      const res = await fetch(api, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      const media = (data.includes?.media || []).map(m => m.url || m.preview_image_url).filter(Boolean);
      return json({ query:q, results: Array.from(new Set(media)).map(u => ({ source:"X", type:"image", url:u })) });
    }

    if (source === "reddit") {
      const id = process.env.REDDIT_CLIENT_ID;
      const secret = process.env.REDDIT_CLIENT_SECRET;
      const user = process.env.REDDIT_USER;
      const pass = process.env.REDDIT_PASS;
      if (!id || !secret || !user || !pass) return json({ error: "Missing Reddit API env vars" }, 400);

      // OAuth token
      const tokRes = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: { "Authorization": "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type":"application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type:"password", username:user, password:pass })
      });
      const tok = await tokRes.json();
      const sub = q; // e.g., pics
      const api = `https://oauth.reddit.com/r/${encodeURIComponent(sub)}/hot?limit=30`;
      const r = await fetch(api, { headers: { "Authorization": `Bearer ${tok.access_token}`, "User-Agent":"ScraperGod/1.0" } });
      const d = await r.json();
      const out = [];
      for (const c of (d?.data?.children || [])) {
        const u = c?.data?.url_overridden_by_dest || c?.data?.url;
        if (typeof u === "string" && /\.(jpg|jpeg|png|gif|webp)$/i.test(u)) out.push({ source:"Reddit", type:"image", url:u });
      }
      return json({ query:q, results: out });
    }

    if (source === "instagram") {
      const token = process.env.IG_ACCESS_TOKEN;
      if (!token) return json({ error: "Missing IG_ACCESS_TOKEN" }, 400);
      // Basic Display doesn't support search; requires user media. This is a placeholder for a user ID you manage.
      const userId = process.env.IG_USER_ID;
      if (!userId) return json({ error: "Missing IG_USER_ID (Basic Display API requires known user id)" }, 400);
      const api = `https://graph.instagram.com/${userId}/media?fields=id,media_type,media_url,thumbnail_url,caption&access_token=${token}`;
      const res = await fetch(api);
      const data = await res.json();
      const out = (data.data || []).map(m => ({ source:"Instagram", type: m.media_type === "VIDEO" ? "video":"image", url: m.media_url || m.thumbnail_url })).filter(x=>x.url);
      return json({ query:q, results: out });
    }

    // Explicitly unsupported paywalled platforms
    if (["onlyfans","fansly","fanvue","only***","fan**y"].includes(source)) {
      return json({ error: "Paywalled platforms are not supported. Use official APIs and your own authenticated session on a compliant backend." }, 400);
    }

    return json({ error: "Unknown source" }, 400);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

function json(obj, status=200) {
  return { statusCode: status, headers: { "Content-Type":"application/json", "Cache-Control":"no-store" }, body: JSON.stringify(obj) };
}
