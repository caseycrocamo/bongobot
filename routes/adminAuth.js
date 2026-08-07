import crypto from 'node:crypto';

/**
 * Express middleware enforcing a shared admin secret (Phase 3).
 *
 * The provided secret is read from the `x-admin-secret` header, or from an
 * `Authorization: Bearer <secret>` header. The expected secret comes from
 * `process.env.ADMIN_SECRET`.
 *
 * - If `ADMIN_SECRET` is unset/empty, the admin API is inert -> 401.
 * - If no secret is provided, or it does not match, -> 401.
 * - Comparison is constant-time via `crypto.timingSafeEqual`.
 *
 * The secret and the provided value are never logged.
 */
export function requireAdminSecret(req, res, next) {
  const expected = process.env.ADMIN_SECRET;

  // Feature is inert without a configured secret.
  if (!expected) {
    return res.status(401).json({ error: 'Admin API disabled' });
  }

  // Prefer the explicit header, fall back to Authorization: Bearer <secret>.
  let provided = req.get('x-admin-secret');
  if (!provided) {
    const auth = req.get('authorization');
    if (auth && auth.startsWith('Bearer ')) {
      provided = auth.slice('Bearer '.length);
    }
  }

  if (!provided) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const providedBuf = Buffer.from(provided);
  const expectedBuf = Buffer.from(expected);

  // timingSafeEqual throws on length mismatch, so guard on length first.
  if (providedBuf.length !== expectedBuf.length) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return next();
}
