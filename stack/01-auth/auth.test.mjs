import assert from "node:assert/strict";
import test from "node:test";
import { createAuthLab } from "./auth.mjs";

function lab(overrides = {}) {
  return createAuthLab({
    users: [
      [
        "usr_admin",
        { id: "usr_admin", phone: "95911111111", role: "admin" },
      ],
      [
        "usr_fan",
        { id: "usr_fan", phone: "95922222222", role: "consumer" },
      ],
    ],
    ...overrides,
  });
}

test("valid OTP issues access + refresh for the stored role", () => {
  const auth = lab();
  const { debugCode } = auth.requestOtp("95922222222");
  const tokens = auth.verifyOtp("95922222222", debugCode, "admin");
  const session = auth.inspectAccess(tokens.access);
  assert.equal(session.role, "consumer");
  assert.equal(session.userId, "usr_fan");
});

test("client-supplied admin role cannot elevate a consumer", () => {
  const auth = lab();
  const { debugCode } = auth.requestOtp("+95 9 222 222 22");
  const tokens = auth.verifyOtp("95922222222", debugCode, "super_admin");
  assert.equal(auth.inspectAccess(tokens.access).role, "consumer");
});

test("OTP locks after five bad attempts", () => {
  const auth = lab();
  auth.requestOtp("95922222222");
  for (let i = 0; i < 4; i += 1) {
    assert.throws(() => auth.verifyOtp("95922222222", "000000"), /otp_invalid/);
  }
  assert.throws(() => auth.verifyOtp("95922222222", "000000"), /otp_locked/);
});

test("expired OTP is rejected", () => {
  let t = 1_000_000;
  const auth = lab({ now: () => t });
  const { debugCode } = auth.requestOtp("95922222222");
  t += 6 * 60 * 1000;
  assert.throws(() => auth.verifyOtp("95922222222", debugCode), /otp_expired/);
});

test("refresh rotates and reuse of the old token revokes the family", () => {
  const auth = lab();
  const { debugCode } = auth.requestOtp("95911111111");
  const first = auth.verifyOtp("95911111111", debugCode);
  const second = auth.refresh(first.refresh);
  assert.notEqual(second.refresh, first.refresh);
  assert.equal(auth.inspectAccess(second.access).role, "admin");
  assert.throws(() => auth.refresh(first.refresh), /refresh_reuse/);
  assert.throws(() => auth.refresh(second.refresh), /refresh_revoked/);
});

test("expired access token is rejected", () => {
  let t = 1_000_000;
  const auth = lab({ now: () => t });
  const { debugCode } = auth.requestOtp("95922222222");
  const tokens = auth.verifyOtp("95922222222", debugCode);
  t += 16 * 60 * 1000;
  assert.throws(() => auth.inspectAccess(tokens.access), /expired_token/);
});
