/**
 * Short public identifier for an account.
 *
 * Shown in the UI and quoted in support e-mails, so it uses an alphabet without
 * the characters people confuse when reading aloud (0/O, 1/I/L) and is generated
 * from a CSPRNG rather than a counter, so it reveals nothing about how many
 * accounts exist.
 */

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const LENGTH = 8;

export function operatorId(random: Crypto = globalThis.crypto): string {
  const bytes = new Uint8Array(LENGTH);
  random.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) {
    // 256 is not a multiple of 31, so the modulo is very slightly biased; for a
    // non-secret display id that is fine, and it keeps the function total.
    out += ALPHABET[byte % ALPHABET.length];
  }
  return out;
}
