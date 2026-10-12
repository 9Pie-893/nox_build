import assert from "node:assert/strict";
import test from "node:test";
import { createInventoryLab } from "./inventory.mjs";

test("confirmation mints server ticket rows and decrements inventory together", () => {
  const lab = createInventoryLab();
  const type = lab.createTicketType({ name: "GA", capacity: 3, price: 15000 });
  const order = lab.createOrder({
    idempotencyKey: "pay_1",
    lines: [{ ticketTypeId: type.id, qty: 2, ticketId: "client_invented" }],
    clientTicketIds: ["tkt_hack"],
  });
  assert.equal(order.status, "confirmed");
  assert.equal(order.ticketIds.length, 2);
  assert.equal(order.ticketIds.includes("tkt_hack"), false);
  assert.equal(order.ticketIds.includes("client_invented"), false);
  assert.equal(lab.getType(type.id).sold, 2);
  assert.equal(lab.ticketsForType(type.id).every((ticket) => ticket.status === "issued"), true);
});

test("oversell rejects the whole order and does not move inventory", () => {
  const lab = createInventoryLab();
  const ga = lab.createTicketType({ name: "GA", capacity: 1 });
  const vip = lab.createTicketType({ name: "VIP", capacity: 5 });
  const order = lab.createOrder({
    idempotencyKey: "pay_over",
    lines: [
      { ticketTypeId: ga.id, qty: 1 },
      { ticketTypeId: vip.id, qty: 6 },
    ],
  });
  assert.equal(order.status, "rejected");
  assert.equal(order.reason, "oversell");
  assert.deepEqual(order.ticketIds, []);
  assert.equal(lab.getType(ga.id).sold, 0);
  assert.equal(lab.getType(vip.id).sold, 0);
});

test("two buyers of the last seat: only the first confirms", () => {
  const lab = createInventoryLab();
  const type = lab.createTicketType({ name: "GA", capacity: 1 });
  const first = lab.createOrder({
    idempotencyKey: "buyer_a",
    lines: [{ ticketTypeId: type.id, qty: 1 }],
  });
  const second = lab.createOrder({
    idempotencyKey: "buyer_b",
    lines: [{ ticketTypeId: type.id, qty: 1 }],
  });
  assert.equal(first.status, "confirmed");
  assert.equal(second.status, "rejected");
  assert.equal(second.reason, "oversell");
  assert.equal(lab.getType(type.id).sold, 1);
  assert.equal(lab.ticketsForType(type.id).length, 1);
});

test("retrying the same idempotency key does not sell twice", () => {
  const lab = createInventoryLab();
  const type = lab.createTicketType({ name: "GA", capacity: 4 });
  const first = lab.createOrder({
    idempotencyKey: "pay_retry",
    lines: [{ ticketTypeId: type.id, qty: 1 }],
  });
  const replay = lab.createOrder({
    idempotencyKey: "pay_retry",
    lines: [{ ticketTypeId: type.id, qty: 3 }],
    clientTicketIds: ["tkt_other"],
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.id, first.id);
  assert.deepEqual(replay.ticketIds, first.ticketIds);
  assert.equal(lab.getType(type.id).sold, 1);
});

test("a rejected key replays the rejection instead of taking stock later", () => {
  const lab = createInventoryLab();
  const type = lab.createTicketType({ name: "GA", capacity: 1 });
  lab.createOrder({
    idempotencyKey: "takes_last",
    lines: [{ ticketTypeId: type.id, qty: 1 }],
  });
  const rejected = lab.createOrder({
    idempotencyKey: "too_late",
    lines: [{ ticketTypeId: type.id, qty: 1 }],
  });
  assert.equal(rejected.status, "rejected");
  const replay = lab.createOrder({
    idempotencyKey: "too_late",
    lines: [{ ticketTypeId: type.id, qty: 1 }],
  });
  assert.equal(replay.replayed, true);
  assert.equal(replay.status, "rejected");
  assert.equal(lab.ticketsForType(type.id).length, 1);
});

test("deleting a ticket type keeps live holders and blocks new sales", () => {
  const lab = createInventoryLab();
  const type = lab.createTicketType({ name: "GA", capacity: 5 });
  const order = lab.createOrder({
    idempotencyKey: "holder",
    lines: [{ ticketTypeId: type.id, qty: 2 }],
  });
  const deleted = lab.deleteTicketType(type.id);
  assert.equal(deleted.status, "deleted");
  assert.equal(deleted.sold, 2);
  const holders = lab.ticketsForType(type.id);
  assert.deepEqual(holders.map((ticket) => ticket.id), order.ticketIds);
  assert.equal(holders.every((ticket) => ticket.status === "issued"), true);
  const again = lab.createOrder({
    idempotencyKey: "after_delete",
    lines: [{ ticketTypeId: type.id, qty: 1 }],
  });
  assert.equal(again.status, "rejected");
  assert.equal(again.reason, "ticket_type_deleted");
  assert.equal(lab.getType(type.id).sold, 2);
});
