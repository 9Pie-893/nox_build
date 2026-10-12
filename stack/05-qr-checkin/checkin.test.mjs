import assert from "node:assert/strict";
import test from "node:test";
import { createCheckinLab } from "./checkin.mjs";

function labAt(start) {
  let t = start;
  const lab = createCheckinLab({ now: () => t, skewMs: 60_000, offlineWindowMs: 15 * 60 * 1000, ttlMs: 60_000 });
  return { lab, setNow: (ms) => { t = ms; }, now: () => t };
}

test("a valid credential enters once and the row is the ticket", () => {
  const { lab } = labAt(1_000_000);
  lab.addTicket({ id: "tkt_1" });
  const token = lab.issueCredential("tkt_1");
  const first = lab.scanOnline(token);
  assert.equal(first.result, "entered");
  assert.equal(lab.getTicket("tkt_1").status, "entered");
  assert.equal(lab.getTicket("tkt_1").enteredAt, 1_000_000);
});

test("a screenshot of the same QR is already entered", () => {
  const { lab } = labAt(1_000_000);
  lab.addTicket({ id: "tkt_1" });
  const token = lab.issueCredential("tkt_1");
  lab.scanOnline(token);
  const again = lab.scanOnline(token);
  assert.equal(again.result, "already_entered");
  assert.equal(lab.getTicket("tkt_1").enteredAt, 1_000_000);
});

test("a bad signature does not enter", () => {
  const { lab } = labAt(1_000_000);
  lab.addTicket({ id: "tkt_1" });
  const token = lab.issueCredential("tkt_1");
  const [body, sig] = token.split(".");
  const flipped = `${body}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;
  assert.equal(lab.scanOnline(flipped).result, "bad_signature");
  assert.equal(lab.getTicket("tkt_1").status, "issued");
});

test("a signed QR for a missing row does not create a ticket", () => {
  const { lab } = labAt(1_000_000);
  const token = lab.debugSeal("tkt_missing", 2_000_000);
  assert.equal(lab.scanOnline(token).result, "unknown_ticket");
  assert.throws(() => lab.getTicket("tkt_missing"), /unknown_ticket/);
});

test("expiry allows a small clock skew and rejects beyond it", () => {
  const { lab, setNow } = labAt(1_000_000);
  lab.addTicket({ id: "tkt_1" });
  const exp = 1_060_000;
  const token = lab.debugSeal("tkt_1", exp);
  setNow(exp + 60_000);
  assert.equal(lab.scanOnline(token).result, "entered");

  const { lab: late, setNow: setLate } = labAt(1_000_000);
  late.addTicket({ id: "tkt_1" });
  const stale = late.debugSeal("tkt_1", exp);
  setLate(exp + 60_001);
  assert.equal(late.scanOnline(stale).result, "expired");
  assert.equal(late.getTicket("tkt_1").status, "issued");
});

test("a voided ticket stays out even with a valid QR", () => {
  const { lab } = labAt(1_000_000);
  lab.addTicket({ id: "tkt_1" });
  const token = lab.issueCredential("tkt_1");
  lab.voidTicket("tkt_1");
  assert.equal(lab.scanOnline(token).result, "void");
  assert.equal(lab.getTicket("tkt_1").status, "void");
});

test("two offline taps of one QR: first enters, second conflicts", () => {
  const { lab, now } = labAt(5_000_000);
  lab.addTicket({ id: "tkt_1" });
  const token = lab.issueCredential("tkt_1");
  const results = lab.syncOffline([
    { localId: "door_b", token, scannedAt: now() - 1_000 },
    { localId: "door_a", token, scannedAt: now() - 2_000 },
  ]);
  const byId = Object.fromEntries(results.map((row) => [row.localId, row.result]));
  assert.equal(byId.door_a, "entered");
  assert.equal(byId.door_b, "already_entered");
  assert.equal(lab.getTicket("tkt_1").status, "entered");
  assert.equal(lab.getTicket("tkt_1").enteredAt, now() - 2_000);
});

test("an offline scan outside the clock window does not enter", () => {
  const { lab, now } = labAt(5_000_000);
  lab.addTicket({ id: "tkt_1" });
  const token = lab.issueCredential("tkt_1");
  const [result] = lab.syncOffline([
    { localId: "stale", token, scannedAt: now() - 60 * 60 * 1000 },
  ]);
  assert.equal(result.result, "clock_skew");
  assert.equal(lab.getTicket("tkt_1").status, "issued");
});

test("an offline replay after an online entry is already entered", () => {
  const { lab, now } = labAt(5_000_000);
  lab.addTicket({ id: "tkt_1" });
  const token = lab.issueCredential("tkt_1");
  assert.equal(lab.scanOnline(token).result, "entered");
  const [result] = lab.syncOffline([{ localId: "late", token, scannedAt: now() - 1_000 }]);
  assert.equal(result.result, "already_entered");
  assert.equal(lab.getTicket("tkt_1").enteredAt, 5_000_000);
});
