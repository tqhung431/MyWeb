// Password hashing with scrypt (built into Node.js, no extra package).
//
// We never store the password. We store: a random salt + scrypt(password, salt).
// scrypt is deliberately slow and memory-hungry, so guessing billions of passwords
// from a stolen database is very expensive.
//
// Stored format: scrypt$N$r$p$<salt base64>$<hash base64>

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 16384; // cost: doubles the work each time it doubles
const r = 8;
const p = 1;
const KEY_LENGTH = 64;

function scryptAsync(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16); // a different salt per user: same password ≠ same hash
  const hash = await scryptAsync(password, salt, { N, r, p });
  return ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, rr, pp, saltB64, hashB64] = stored.split("$");
  if (algo !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scryptAsync(password, Buffer.from(saltB64, "base64"), {
    N: Number(n),
    r: Number(rr),
    p: Number(pp),
  });
  // Compare in constant time, so the response time doesn't leak how many bytes matched.
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Used when the email doesn't exist, so "no such user" takes as long as "wrong password".
// Otherwise an attacker could time responses to learn which emails have accounts.
let dummyHash: Promise<string> | null = null;
export async function burnTime(password: string): Promise<void> {
  dummyHash ??= hashPassword("not-a-real-password");
  await verifyPassword(password, await dummyHash);
}
