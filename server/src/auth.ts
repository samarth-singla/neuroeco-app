import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';

function same(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * HTTP Basic auth for /admin and the exports. Any username works; the password must
 * equal ADMIN_PASSWORD. The browser remembers it, so the download links just work.
 */
export function requireAdmin(password: string): RequestHandler {
  return (req, res, next) => {
    if (!password) {
      res.status(503).send('Admin is disabled: set ADMIN_PASSWORD in .env');
      return;
    }
    const header = req.headers.authorization ?? '';
    if (header.startsWith('Basic ')) {
      const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
      const given = decoded.slice(decoded.indexOf(':') + 1);
      if (same(given, password)) return next();
    }
    res.set('WWW-Authenticate', 'Basic realm="neuroeco-admin", charset="UTF-8"');
    res.status(401).send('Password required');
  };
}
