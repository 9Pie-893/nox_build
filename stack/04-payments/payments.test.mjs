import assert from "node:assert/strict";
import test from "node:test";
import { createPaymentsLab } from "./payments.mjs";

function body(event) {
  return JSON.stringify(event);
}

test("a client success screen does not mark the order paid", () => {
  const lab = createPaymentsLab();
  lab.createOrder({ id: "ord_1", amount: 20000, currency: "MMK" });
  const claim = lab.clientClaimsPaid("ord_1");
  assert.equal(claim.ignored, true);
  assert.equal(lab.getOrder("ord_1").status, "pending");
  assert.equal(lab.settlementCount("ord_1"), 0);
});

test("unsigned webhook is rejected and does not settle", () => {
  const lab = createPaymentsLab();
  lab.createOrder({ id: "ord_1", amount: 20000, currency: "MMK" });
  const raw = body({
    eventId: "evt_unsigned",
    orderId: "ord_1",
    amount: 20000,
    currency: "MMK",
    status: "settled",
  });
  const result = lab.ingestWebhook({ rawBody: raw, signature: "" });
  assert.equal(result.status, "rejected");
  assert.equal(result.reason, "bad_signature");
  assert.equal(result.applied, false);
  assert.equal(lab.getOrder("ord_1").status, "pending");
});

test("bad signature is rejected before any order change", () => {
  const lab = createPaymentsLab();
  lab.createOrder({ id: "ord_1", amount: 20000, currency: "MMK" });
  const raw = body({
    eventId: "evt_bad",
    orderId: "ord_1",
    amount: 20000,
    currency: "MMK",
    status: "settled",
  });
  const signed = lab.sign(raw);
  const flipped = (signed[0] === "0" ? "1" : "0") + signed.slice(1);
  const result = lab.ingestWebhook({ rawBody: raw, signature: flipped });
  assert.equal(result.reason, "bad_signature");
  assert.equal(lab.getOrder("ord_1").status, "pending");
});

test("signed settlement marks paid once", () => {
  const lab = createPaymentsLab();
  lab.createOrder({ id: "ord_1", amount: 20000, currency: "MMK" });
  const raw = body({
    eventId: "evt_ok",
    orderId: "ord_1",
    amount: 20000,
    currency: "MMK",
    status: "settled",
    note: "ignored extra field",
  });
  const result = lab.ingestWebhook({ rawBody: raw, signature: lab.sign(raw) });
  assert.equal(result.applied, true);
  assert.equal(lab.getOrder("ord_1").status, "paid");
  assert.equal(lab.settlementCount("ord_1"), 1);
});

test("replaying the same webhook does not settle twice", () => {
  const lab = createPaymentsLab();
  lab.createOrder({ id: "ord_1", amount: 20000, currency: "MMK" });
  const raw = body({
    eventId: "evt_ok",
    orderId: "ord_1",
    amount: 20000,
    currency: "MMK",
    status: "settled",
  });
  const signature = lab.sign(raw);
  lab.ingestWebhook({ rawBody: raw, signature });
  const replay = lab.ingestWebhook({ rawBody: raw, signature });
  assert.equal(replay.replayed, true);
  assert.equal(replay.applied, false);
  assert.equal(lab.getOrder("ord_1").status, "paid");
  assert.equal(lab.settlementCount("ord_1"), 1);
});

test("amount mismatch does not mark paid, and a later correct event can", () => {
  const lab = createPaymentsLab();
  lab.createOrder({ id: "ord_1", amount: 20000, currency: "MMK" });
  const wrong = body({
    eventId: "evt_wrong",
    orderId: "ord_1",
    amount: 1,
    currency: "MMK",
    status: "settled",
  });
  const rejected = lab.ingestWebhook({ rawBody: wrong, signature: lab.sign(wrong) });
  assert.equal(rejected.reason, "amount_mismatch");
  assert.equal(lab.getOrder("ord_1").status, "pending");
  const again = lab.ingestWebhook({ rawBody: wrong, signature: lab.sign(wrong) });
  assert.equal(again.replayed, true);
  assert.equal(lab.getOrder("ord_1").status, "pending");

  const right = body({
    eventId: "evt_right",
    orderId: "ord_1",
    amount: 20000,
    currency: "MMK",
    status: "settled",
  });
  const applied = lab.ingestWebhook({ rawBody: right, signature: lab.sign(right) });
  assert.equal(applied.applied, true);
  assert.equal(lab.settlementCount("ord_1"), 1);
});

test("a second settlement event for an already paid order does not double-count", () => {
  const lab = createPaymentsLab();
  lab.createOrder({ id: "ord_1", amount: 20000, currency: "MMK" });
  const first = body({
    eventId: "evt_1",
    orderId: "ord_1",
    amount: 20000,
    currency: "MMK",
    status: "settled",
  });
  lab.ingestWebhook({ rawBody: first, signature: lab.sign(first) });
  const second = body({
    eventId: "evt_2",
    orderId: "ord_1",
    amount: 20000,
    currency: "MMK",
    status: "settled",
  });
  const result = lab.ingestWebhook({ rawBody: second, signature: lab.sign(second) });
  assert.equal(result.reason, "already_paid");
  assert.equal(result.applied, false);
  assert.equal(lab.settlementCount("ord_1"), 1);
});

test("webhook for an unknown order does not create one, and can apply after the order exists", () => {
  const lab = createPaymentsLab();
  const raw = body({
    eventId: "evt_early",
    orderId: "ord_late",
    amount: 9000,
    currency: "MMK",
    status: "settled",
  });
  const early = lab.ingestWebhook({ rawBody: raw, signature: lab.sign(raw) });
  assert.equal(early.reason, "unknown_order");
  assert.throws(() => lab.getOrder("ord_late"), /unknown_order/);
  lab.createOrder({ id: "ord_late", amount: 9000, currency: "MMK" });
  const later = lab.ingestWebhook({ rawBody: raw, signature: lab.sign(raw) });
  assert.equal(later.applied, true);
  assert.equal(lab.getOrder("ord_late").status, "paid");
});
