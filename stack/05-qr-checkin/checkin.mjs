/**
 * NOX check-in lab — HMAC credential + ticket row.
 * The QR is not the ticket. Not a Flutter scanner.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function fail(code) {
  return Object.assign(new Error(code), { code });
}

function seal(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function open(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return { ok: false, reason: "malformed" };
  const [body, sig] = parts;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const given = Buffer.from(sig);
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return { ok: false, reason: "bad_signature" };
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!payload || typeof payload.tid !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  return { ok: true, tid: payload.tid, exp: payload.exp };
}

export function createCheckinLab(opts = {}) {
  const secret = opts.secret || "lab-door-secret";
  const now = opts.now || (() => Date.now());
  const skewMs = opts.skewMs ?? 2 * 60 * 1000;
  const ttlMs = opts.ttlMs ?? 12 * 60 * 60 * 1000;
  const offlineWindowMs = opts.offlineWindowMs ?? 15 * 60 * 1000;
  const tickets = new Map();

  function publicTicket(ticket) {
    return { id: ticket.id, status: ticket.status, enteredAt: ticket.enteredAt };
  }

  function verify(token) {
    const opened = open(token, secret);
    if (!opened.ok) return opened;
    if (now() > opened.exp + skewMs) return { ok: false, reason: "expired" };
    return opened;
  }

  function gate(tid) {
    const ticket = tickets.get(tid);
    if (!ticket) return { result: "unknown_ticket" };
    if (ticket.status === "void") return { result: "void" };
    if (ticket.status === "entered") return { result: "already_entered", enteredAt: ticket.enteredAt };
    if (ticket.status !== "issued") return { result: "not_issued" };
    return null;
  }

  function enter(tid, at) {
    const ticket = tickets.get(tid);
    ticket.status = "entered";
    ticket.enteredAt = at;
    return { result: "entered", ticketId: tid, enteredAt: at };
  }

  return {
    addTicket({ id, status = "issued" }) {
      if (!id || String(id).includes(".")) throw fail("invalid_ticket");
      if (tickets.has(id)) throw fail("ticket_exists");
      const ticket = { id, status, enteredAt: null };
      tickets.set(id, ticket);
      return publicTicket(ticket);
    },

    voidTicket(id) {
      const ticket = tickets.get(id);
      if (!ticket) throw fail("unknown_ticket");
      if (ticket.status === "entered") throw fail("already_entered");
      ticket.status = "void";
      return publicTicket(ticket);
    },

    issueCredential(id) {
      const ticket = tickets.get(id);
      if (!ticket) throw fail("unknown_ticket");
      if (ticket.status === "void") throw fail("void");
      return seal({ tid: id, exp: now() + ttlMs }, secret);
    },

    debugSeal(tid, exp) {
      return seal({ tid, exp }, secret);
    },

    scanOnline(token) {
      const verified = verify(token);
      if (!verified.ok) return { result: verified.reason };
      const blocked = gate(verified.tid);
      if (blocked) return blocked;
      return enter(verified.tid, now());
    },

    syncOffline(scans) {
      const ordered = [...scans].sort(
        (a, b) => a.scannedAt - b.scannedAt || (a.localId < b.localId ? -1 : a.localId > b.localId ? 1 : 0),
      );
      return ordered.map((scan) => {
        if (Math.abs(scan.scannedAt - now()) > offlineWindowMs) {
          return { localId: scan.localId, result: "clock_skew" };
        }
        const verified = verify(scan.token);
        if (!verified.ok) return { localId: scan.localId, result: verified.reason };
        const blocked = gate(verified.tid);
        if (blocked) return { localId: scan.localId, ...blocked };
        return { localId: scan.localId, ...enter(verified.tid, scan.scannedAt) };
      });
    },

    getTicket(id) {
      const ticket = tickets.get(id);
      if (!ticket) throw fail("unknown_ticket");
      return publicTicket(ticket);
    },
  };
}
