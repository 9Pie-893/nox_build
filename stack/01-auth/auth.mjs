/**
 * NOX auth lab — primitives only.
 * Not a production auth service. No SMS rail. No persistence beyond process memory.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const ROLES = Object.freeze([
  "consumer",
  "organizer",
  "venue",
  "scanner",
  "admin",
  "super_admin",
]);

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;
const ACCESS_TTL_MS = 15 * 60 * 1000;
const REFRESH_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function b64url(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function sign(payload, secret) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verify(token, secret) {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw Object.assign(new Error("malformed_token"), { code: "malformed_token" });
  const [header, body, sig] = parts;
  const expected = b64url(createHmac("sha256", secret).update(`${header}.${body}`).digest());
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw Object.assign(new Error("bad_signature"), { code: "bad_signature" });
  }
  const payload = JSON.parse(Buffer.from(body.replaceAll("-", "+").replaceAll("_", "/"), "base64").toString("utf8"));
  if (payload.exp && Date.now() >= payload.exp) {
    throw Object.assign(new Error("expired_token"), { code: "expired_token" });
  }
  return payload;
}

function normalizePhone(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8) throw Object.assign(new Error("invalid_phone"), { code: "invalid_phone" });
  return digits;
}

export function createAuthLab(opts = {}) {
  const accessSecret = opts.accessSecret || "lab-access-secret";
  const refreshSecret = opts.refreshSecret || "lab-refresh-secret";
  const now = opts.now || (() => Date.now());
  const users = new Map(opts.users || []);
  const otps = new Map();
  const refreshFamilies = new Map();

  function issuePair(user, existingFamilyId) {
    const familyId = existingFamilyId || `${user.id}:${now()}:${randomInt(1e9)}`;
    const refreshId = `r_${randomInt(1e9)}`;
    const access = sign(
      {
        sub: user.id,
        role: user.role,
        typ: "access",
        iat: now(),
        exp: now() + ACCESS_TTL_MS,
      },
      accessSecret,
    );
    const refresh = sign(
      {
        sub: user.id,
        role: user.role,
        typ: "refresh",
        fid: familyId,
        jti: refreshId,
        iat: now(),
        exp: now() + REFRESH_TTL_MS,
      },
      refreshSecret,
    );
    refreshFamilies.set(familyId, { userId: user.id, currentJti: refreshId, revoked: false });
    return { access, refresh, familyId };
  }

  return {
    requestOtp(phone) {
      const key = normalizePhone(phone);
      const code = String(randomInt(100000, 999999));
      otps.set(key, { code, exp: now() + OTP_TTL_MS, attempts: 0 });
      return { phone: key, debugCode: code, expiresAt: now() + OTP_TTL_MS };
    },

    verifyOtp(phone, code, claimedRole) {
      const key = normalizePhone(phone);
      const row = otps.get(key);
      if (!row) throw Object.assign(new Error("otp_not_found"), { code: "otp_not_found" });
      if (now() >= row.exp) {
        otps.delete(key);
        throw Object.assign(new Error("otp_expired"), { code: "otp_expired" });
      }
      if (row.attempts >= OTP_MAX_ATTEMPTS) {
        throw Object.assign(new Error("otp_locked"), { code: "otp_locked" });
      }
      row.attempts += 1;
      if (String(code) !== row.code) {
        if (row.attempts >= OTP_MAX_ATTEMPTS) {
          throw Object.assign(new Error("otp_locked"), { code: "otp_locked" });
        }
        throw Object.assign(new Error("otp_invalid"), { code: "otp_invalid" });
      }
      otps.delete(key);

      let user = [...users.values()].find((u) => u.phone === key);
      if (!user) {
        user = {
          id: `usr_${users.size + 1}`,
          phone: key,
          role: "consumer",
        };
        users.set(user.id, user);
      }
      void claimedRole;
      return issuePair(user);
    },

    inspectAccess(token) {
      const payload = verify(token, accessSecret);
      if (payload.typ !== "access") throw Object.assign(new Error("wrong_token_type"), { code: "wrong_token_type" });
      const user = users.get(payload.sub);
      if (!user) throw Object.assign(new Error("unknown_user"), { code: "unknown_user" });
      return { userId: user.id, role: user.role };
    },

    refresh(token) {
      const payload = verify(token, refreshSecret);
      if (payload.typ !== "refresh") throw Object.assign(new Error("wrong_token_type"), { code: "wrong_token_type" });
      const family = refreshFamilies.get(payload.fid);
      if (!family) {
        throw Object.assign(new Error("refresh_revoked"), { code: "refresh_revoked" });
      }
      if (family.currentJti !== payload.jti) {
        family.revoked = true;
        throw Object.assign(new Error("refresh_reuse"), { code: "refresh_reuse" });
      }
      if (family.revoked) {
        throw Object.assign(new Error("refresh_revoked"), { code: "refresh_revoked" });
      }
      const user = users.get(payload.sub);
      if (!user) throw Object.assign(new Error("unknown_user"), { code: "unknown_user" });
      return issuePair(user, payload.fid);
    },

    _debug: { users, otps, refreshFamilies },
  };
}
