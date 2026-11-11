import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

function scrypt(
  password: string,
  salt: string,
  keyLength: number,
  options: { N: number },
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, keyLength, options, (err, derived) =>
      err ? reject(err) : resolve(derived),
    );
  });
}

const KEY_LENGTH = 32;
const SCRYPT_COST = 16_384;

/**
 * Hash a child PIN with scrypt. PINs are short, so this relies on server-side
 * lockout (see child-session.ts) as much as on hashing cost.
 */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = await scrypt(pin, salt, KEY_LENGTH, { N: SCRYPT_COST });
  return `scrypt$${SCRYPT_COST}$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [algo, costStr, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !costStr || !salt || !hash) return false;
  const derived = await scrypt(pin, salt, KEY_LENGTH, { N: Number(costStr) });
  const expected = Buffer.from(hash, "base64url");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
