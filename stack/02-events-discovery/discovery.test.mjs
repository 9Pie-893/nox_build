import assert from "node:assert/strict";
import test from "node:test";
import { createDiscoveryLab } from "./discovery.mjs";

const DOWNTOWN = { lat: 16.805, lng: 96.156 };
const FAR = { lat: 16.4, lng: 96.8 };

function seed() {
  let t = Date.parse("2026-10-12T20:00:00+06:30");
  const lab = createDiscoveryLab({ now: () => t });
  lab.upsert({
    id: "evt_draft",
    title: "Secret warehouse",
    venueName: "Unlisted",
    startsAt: Date.parse("2026-10-12T22:00:00+06:30"),
    organizerPhone: "95900000001",
    internalNotes: "do not leak",
    ...DOWNTOWN,
  });
  lab.upsert({
    id: "evt_a",
    title: "Cyan Room",
    venueName: "The Room",
    startsAt: Date.parse("2026-10-12T21:00:00+06:30"),
    organizerPhone: "95900000002",
    internalNotes: "door deal",
    ...DOWNTOWN,
  });
  lab.upsert({
    id: "evt_b",
    title: "Violet Hour",
    venueName: "Basement",
    startsAt: Date.parse("2026-10-12T23:00:00+06:30"),
    ...DOWNTOWN,
  });
  lab.upsert({
    id: "evt_far",
    title: "Out of town",
    venueName: "Highway",
    startsAt: Date.parse("2026-10-12T21:30:00+06:30"),
    ...FAR,
  });
  lab.upsert({
    id: "evt_tomorrow",
    title: "Tomorrow",
    venueName: "The Room",
    startsAt: Date.parse("2026-10-13T21:00:00+06:30"),
    ...DOWNTOWN,
  });
  lab.publish("evt_a");
  lab.publish("evt_b");
  lab.publish("evt_far");
  lab.publish("evt_tomorrow");
  return { lab, setNow: (ms) => { t = ms; } };
}

test("drafts never appear in the feed", () => {
  const { lab } = seed();
  const feed = lab.feed({ tonight: true, city: "Yangon" });
  assert.equal(feed.items.some((item) => item.id === "evt_draft"), false);
  assert.deepEqual(Object.keys(feed.items[0]).sort(), [
    "city",
    "id",
    "lat",
    "lng",
    "startsAt",
    "title",
    "venueName",
  ]);
});

test("search does not return organizer phone or internal notes", () => {
  const { lab } = seed();
  const hits = lab.search("95900000002");
  assert.equal(hits.length, 0);
  const byTitle = lab.search("door deal");
  assert.equal(byTitle.length, 0);
  const room = lab.search("cyan");
  assert.equal(room.length, 1);
  assert.equal("organizerPhone" in room[0], false);
  assert.equal("internalNotes" in room[0], false);
  assert.equal(lab.search("secret warehouse").length, 0);
});

test("cursor pages do not overlap or skip", () => {
  const { lab } = seed();
  const first = lab.feed({ tonight: true, limit: 1, lat: DOWNTOWN.lat, lng: DOWNTOWN.lng, radiusKm: 5 });
  const second = lab.feed({
    tonight: true,
    limit: 1,
    cursor: first.nextCursor,
    lat: DOWNTOWN.lat,
    lng: DOWNTOWN.lng,
    radiusKm: 5,
  });
  assert.deepEqual(first.items.map((i) => i.id), ["evt_a"]);
  assert.deepEqual(second.items.map((i) => i.id), ["evt_b"]);
  assert.equal(first.items[0].id === second.items[0].id, false);
});

test("geo filter drops events outside the radius", () => {
  const { lab } = seed();
  const near = lab.feed({ tonight: true, lat: DOWNTOWN.lat, lng: DOWNTOWN.lng, radiusKm: 5 });
  assert.equal(near.items.some((item) => item.id === "evt_far"), false);
  assert.equal(near.items.some((item) => item.id === "evt_a"), true);
});

test("unpublish kills a cached tonight list", () => {
  const { lab } = seed();
  const first = lab.feed({ tonight: true, city: "Yangon" });
  assert.equal(first.cached, false);
  assert.equal(first.items.some((item) => item.id === "evt_a"), true);
  const second = lab.feed({ tonight: true, city: "Yangon" });
  assert.equal(second.cached, true);
  lab.unpublish("evt_a");
  const third = lab.feed({ tonight: true, city: "Yangon" });
  assert.equal(third.cached, false);
  assert.equal(third.items.some((item) => item.id === "evt_a"), false);
});

test("editing a published event drops the cached card", () => {
  const { lab } = seed();
  lab.feed({ tonight: true, city: "Yangon" });
  lab.upsert({
    id: "evt_a",
    title: "Cyan Room Late",
    venueName: "The Room",
    startsAt: Date.parse("2026-10-12T21:00:00+06:30"),
    ...DOWNTOWN,
  });
  const after = lab.feed({ tonight: true, city: "Yangon" });
  assert.equal(after.cached, false);
  assert.equal(after.items.find((item) => item.id === "evt_a").title, "Cyan Room Late");
});

test("publish invalidates cache so a new tonight event appears", () => {
  const { lab } = seed();
  const before = lab.feed({ tonight: true, city: "Yangon" });
  assert.equal(before.items.some((item) => item.id === "evt_draft"), false);
  lab.publish("evt_draft");
  const after = lab.feed({ tonight: true, city: "Yangon" });
  assert.equal(after.cached, false);
  assert.equal(after.items.some((item) => item.id === "evt_draft"), true);
  assert.equal(after.items.some((item) => item.id === "evt_tomorrow"), false);
});
