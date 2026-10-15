import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const SALT_BYTES = 16;
const KEY_BYTES = 32;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const key = (await scrypt(password, salt, KEY_BYTES)) as Buffer;
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

let timingPad: Promise<string> | null = null;

/** Compare a password. An unknown account still runs scrypt so the two cases take similar time. */
export async function passwordMatches(password: string, stored: string | null): Promise<boolean> {
  if (!stored) {
    timingPad ??= hashPassword("playchess-timing-pad");
    await verifyPassword(password, await timingPad);
    return false;
  }
  return verifyPassword(password, stored);
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, encoded] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !encoded) {
    return false;
  }

  const saltBuffer = Buffer.from(salt, "base64url");
  const expected = Buffer.from(encoded, "base64url");
  const actual = (await scrypt(password, saltBuffer, expected.length)) as Buffer;
  if (actual.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(actual, expected);
}
