/**
 * A throwaway account, invented for the test suite.
 *
 * The deployment's real credentials live in environment variables and must
 * never appear in the repository — not in a config file and not in a test
 * fixture. So the suite makes up its own account instead: the local server
 * derives the hash at boot and the browser test signs in with the same
 * password. Nothing here unlocks anything that exists.
 *
 * Real credentials in the environment always win, so the same tests can be
 * pointed at a live deployment.
 */
import { pbkdf2Sync, randomBytes } from 'node:crypto'

export const USER = process.env.GATE_USER ?? 'test-dm'
export const PASS = process.env.GATE_PASS ?? 'a-password-that-guards-nothing'

const SALT = 'f1e2d3c4b5a69788776655443322110f'

/** Point lib/auth at the throwaway account unless a real one is configured. */
export function useTestAccount() {
  if (process.env.ADMIN_HASH) return
  process.env.ADMIN_USER = USER
  process.env.ADMIN_SALT = SALT
  process.env.ADMIN_HASH = pbkdf2Sync(PASS, SALT, 210_000, 32, 'sha256').toString('hex')
  // A fresh signing key per run, so a token from one run cannot verify in the next.
  process.env.AUTH_SECRET = randomBytes(32).toString('hex')
}
