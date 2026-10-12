/**
 * NOX discovery lab — in-memory feed primitive.
 * Not production Postgres + Redis. No Flutter, no PostHog.
 */
const YANGON_OFFSET_MS = (6 * 60 + 30) * 60 * 1000;

function publicCard(event) {
  return {
    id: event.id,
    title: event.title,
    venueName: event.venueName,
    city: event.city,
    startsAt: event.startsAt,
    lat: event.lat,
    lng: event.lng,
  };
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const r = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(s)));
}

function yangonDay(ms) {
  const shifted = new Date(ms + YANGON_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

function encodeCursor(event) {
  return Buffer.from(JSON.stringify({ startsAt: event.startsAt, id: event.id }), "utf8").toString("base64url");
}

function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed.startsAt !== "number" || typeof parsed.id !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

function afterCursor(event, cursor) {
  if (!cursor) return true;
  if (event.startsAt > cursor.startsAt) return true;
  if (event.startsAt === cursor.startsAt && event.id > cursor.id) return true;
  return false;
}

export function createDiscoveryLab(opts = {}) {
  const now = opts.now || (() => Date.now());
  const events = new Map();
  const cache = new Map();

  function visible(event, query) {
    if (event.status !== "published") return false;
    if (query.city && event.city !== query.city) return false;
    if (query.tonight && yangonDay(event.startsAt) !== yangonDay(now())) return false;
    if (
      query.lat != null &&
      query.lng != null &&
      query.radiusKm != null &&
      haversineKm(query.lat, query.lng, event.lat, event.lng) > query.radiusKm
    ) {
      return false;
    }
    return true;
  }

  function queryFeed(query) {
    const limit = Math.min(Math.max(query.limit || 20, 1), 50);
    const cursor = decodeCursor(query.cursor);
    const rows = [...events.values()]
      .filter((event) => visible(event, query) && afterCursor(event, cursor))
      .sort((a, b) => a.startsAt - b.startsAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const page = rows.slice(0, limit).map(publicCard);
    const last = rows[limit - 1];
    return {
      items: page,
      nextCursor: rows.length > limit && last ? encodeCursor(last) : null,
    };
  }

  function cacheKey(query) {
    return JSON.stringify({
      city: query.city || null,
      tonight: Boolean(query.tonight),
      lat: query.lat ?? null,
      lng: query.lng ?? null,
      radiusKm: query.radiusKm ?? null,
      cursor: query.cursor || null,
      limit: query.limit || 20,
      day: query.tonight ? yangonDay(now()) : null,
    });
  }

  return {
    upsert(event) {
      if (!event?.id) throw Object.assign(new Error("missing_id"), { code: "missing_id" });
      const existing = events.get(event.id);
      const next = {
        id: event.id,
        title: event.title || "",
        venueName: event.venueName || "",
        city: event.city || "Yangon",
        startsAt: event.startsAt,
        lat: event.lat,
        lng: event.lng,
        status: existing?.status || "draft",
        organizerPhone: event.organizerPhone || null,
        internalNotes: event.internalNotes || null,
      };
      const wasLive = existing?.status === "published";
      events.set(event.id, next);
      if (wasLive) cache.clear();
      return { id: next.id, status: next.status };
    },

    publish(id) {
      const event = events.get(id);
      if (!event) throw Object.assign(new Error("not_found"), { code: "not_found" });
      event.status = "published";
      cache.clear();
      return { id, status: event.status };
    },

    unpublish(id) {
      const event = events.get(id);
      if (!event) throw Object.assign(new Error("not_found"), { code: "not_found" });
      event.status = "unpublished";
      cache.clear();
      return { id, status: event.status };
    },

    feed(query = {}) {
      const key = cacheKey(query);
      const hit = cache.get(key);
      if (hit) return { ...hit, cached: true };
      const fresh = queryFeed(query);
      cache.set(key, fresh);
      return { ...fresh, cached: false };
    },

    search(q) {
      const needle = String(q || "").trim().toLowerCase();
      if (!needle) return [];
      return [...events.values()]
        .filter((event) => event.status === "published")
        .filter((event) => {
          const hay = `${event.title} ${event.venueName}`.toLowerCase();
          return hay.includes(needle);
        })
        .map(publicCard);
    },

    _debug: { events, cache },
  };
}
