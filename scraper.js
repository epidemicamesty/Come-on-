// netlify/functions/scraper.js
// Works on open/public sources only. No logins/paywalls.
// Uses Node 18's global fetch (no dependencies).
const IMG_REGEX = /<img[^>]+src=["']([^"']+)["']/gi;

const uniqBy = (arr, keyFn) => {
  const seen = new Set(), out = [];
  for (const x of arr) { const k = keyFn(x); if (!seen.has(k)) { seen.add(k); out.push(x); } }
  return out;
};

export async function handler(event) {
  const q = (event.queryStringParameters?.q || "").trim();
  const results = [];
  if (!q) return json({ query:q, results });

  try {
    const lower = q.toLowerCase();

    // Rule34 (HTML)
    if (lower.startsWith("rule34")) {
      const term = q.replace(/rule34/i, "").trim();
      const url = `https://rule34.xxx/index.php?page=post&s=list&tags=${encodeURIComponent(term)}`;
      const html = await (await fetch(url)).text();
      let m; while ((m = IMG_REGEX.exec(html)) !== null) {
        const src = m[1]; if (src && src.startsWith("http")) results.push({ source:"Rule34", type:"image", url: src });
      }
    }

    // e621 (JSON)
    if (lower.startsWith("e621")) {
      const term = q.replace(/e621/i, "").trim();
      const url = `https://e621.net/posts.json?tags=${encodeURIComponent(term)}&limit=30`;
      const data = await (await fetch(url, { headers: { "User-Agent": "ScraperGod/1.0 (Netlify)" } })).json();
      for (const p of (data?.posts || [])) { const u = p?.file?.url; if (u) results.push({ source:"e621", type:"image", url: u }); }
    }

    // Gelbooru (JSON)
    if (lower.startsWith("gelbooru")) {
      const term = q.replace(/gelbooru/i, "").trim();
      const url = `https://gelbooru.com/index.php?page=dapi&s=post&q=index&json=1&limit=30&tags=${encodeURIComponent(term)}`;
      const data = await (await fetch(url)).json();
      if (Array.isArray(data)) for (const p of data) { const u = p?.file_url; if (u) results.push({ source:"Gelbooru", type:"image", url: u }); }
    }

    // Reddit (public JSON)
    if (lower.startsWith("reddit")) {
      const sub = q.replace(/reddit/i, "").trim();
      const url = `https://www.reddit.com/r/${encodeURIComponent(sub)}/top.json?limit=30&t=month`;
      const data = await (await fetch(url, { headers: { "User-Agent": "ScraperGod/1.0" } })).json();
      for (const c of (data?.data?.children || [])) {
        const u = c?.data?.url_overridden_by_dest || c?.data?.url;
        if (typeof u === "string" && /\.(jpg|jpeg|png|gif|webp)$/i.test(u)) results.push({ source:"Reddit", type:"image", url: u });
      }
    }

    // Generic <img> fallback (any open URL or domain)
    if (results.length === 0) {
      const guess = lower.startsWith("http") ? q : `https://${q}`;
      try {
        const html = await (await fetch(guess, { headers: { "User-Agent": "ScraperGod/1.0" } })).text();
        let m; while ((m = IMG_REGEX.exec(html)) !== null) {
          const src = m[1]; if (src && src.startsWith("http")) results.push({ source:"Generic", type:"image", url: src });
        }
      } catch {}
    }

    const clean = uniqBy(results, x => x.url).slice(0, 60);
    return json({ query:q, results: clean });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

function json(obj, status=200) {
  return { statusCode: status, headers: { "Content-Type":"application/json", "Cache-Control":"no-store" }, body: JSON.stringify(obj) };
}
