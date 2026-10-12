/**
 * NOX payments lab — provider port + webhook inbox.
 * The lab rail is local HMAC only. It is not KBZPay, WavePay, AYA Pay, or CBPay.
 * Do not add endpoints for those rails here.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function fail(code) {
  return Object.assign(new Error(code), { code });
}

export function createLabRail(secret) {
  return {
    name: "lab-rail",
    sign(rawBody) {
      return createHmac("sha256", secret).update(rawBody).digest("hex");
    },
    verify(rawBody, signature) {
      const expected = createHmac("sha256", secret).update(String(rawBody)).digest("hex");
      const given = Buffer.from(String(signature || ""), "utf8");
      const wanted = Buffer.from(expected, "utf8");
      if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
        throw fail("bad_signature");
      }
      let event;
      try {
        event = JSON.parse(rawBody);
      } catch {
        throw fail("malformed_body");
      }
      if (!event || typeof event.eventId !== "string" || typeof event.orderId !== "string") {
        throw fail("malformed_event");
      }
      return {
        eventId: event.eventId,
        orderId: event.orderId,
        amount: event.amount,
        currency: event.currency,
        status: event.status,
      };
    },
  };
}

export function createPaymentsLab(opts = {}) {
  const rail = opts.rail || createLabRail(opts.secret || "lab-rail-secret");
  const orders = new Map();
  const inbox = new Map();
  const settlements = [];

  function publicOrder(order) {
    return {
      id: order.id,
      amount: order.amount,
      currency: order.currency,
      status: order.status,
    };
  }

  return {
    railName: rail.name,
    sign(rawBody) {
      return rail.sign(rawBody);
    },

    createOrder({ id, amount, currency = "MMK" }) {
      if (!id || !Number.isInteger(amount) || amount < 1) throw fail("invalid_order");
      if (orders.has(id)) throw fail("order_exists");
      const order = { id, amount, currency, status: "pending" };
      orders.set(id, order);
      return publicOrder(order);
    },

    clientClaimsPaid(orderId) {
      const order = orders.get(orderId);
      if (!order) throw fail("unknown_order");
      return { ...publicOrder(order), ignored: true };
    },

    ingestWebhook({ rawBody, signature }) {
      let event;
      try {
        event = rail.verify(rawBody, signature);
      } catch (err) {
        return { status: "rejected", reason: err.code || "rejected", applied: false, replayed: false };
      }

      const seen = inbox.get(event.eventId);
      if (seen) {
        return {
          status: seen.status,
          reason: seen.reason,
          applied: false,
          replayed: true,
          eventId: event.eventId,
        };
      }

      const order = orders.get(event.orderId);
      if (!order) {
        return { status: "rejected", reason: "unknown_order", applied: false, replayed: false, eventId: event.eventId };
      }
      if (event.status !== "settled") {
        inbox.set(event.eventId, { status: "rejected", reason: "not_settled", rawBody });
        return { status: "rejected", reason: "not_settled", applied: false, replayed: false, eventId: event.eventId };
      }
      if (event.amount !== order.amount || event.currency !== order.currency) {
        inbox.set(event.eventId, { status: "rejected", reason: "amount_mismatch", rawBody });
        return { status: "rejected", reason: "amount_mismatch", applied: false, replayed: false, eventId: event.eventId };
      }
      if (order.status === "paid") {
        inbox.set(event.eventId, { status: "ignored", reason: "already_paid", rawBody });
        return { status: "ignored", reason: "already_paid", applied: false, replayed: false, eventId: event.eventId };
      }

      order.status = "paid";
      settlements.push({ eventId: event.eventId, orderId: order.id, amount: order.amount, currency: order.currency });
      inbox.set(event.eventId, { status: "applied", reason: null, rawBody });
      return { status: "applied", reason: null, applied: true, replayed: false, eventId: event.eventId };
    },

    getOrder(id) {
      const order = orders.get(id);
      if (!order) throw fail("unknown_order");
      return publicOrder(order);
    },

    settlementCount(orderId) {
      return settlements.filter((row) => row.orderId === orderId).length;
    },
  };
}
