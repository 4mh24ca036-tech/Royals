import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 32) {
    return fromEnv;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable is required and must be at least 32 characters long');
  }
  console.warn('JWT_SECRET is not set: using an ephemeral development secret. Sessions will not survive a restart.');
  return crypto.randomBytes(48).toString('hex');
}

const JWT_SECRET = resolveJwtSecret();

export interface UserJwtPayload {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface AdminJwtPayload {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
}

const USER_AUDIENCE = 'royals:customer';
const ADMIN_AUDIENCE = 'royals:admin';

export function generateUserToken(payload: UserJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d', audience: USER_AUDIENCE });
}

export function generateAdminToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d', audience: ADMIN_AUDIENCE });
}

function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.slice('Bearer '.length).trim() || null;
}

// Populates req.user when a valid customer token is present, without rejecting anonymous requests.
export function optionalAuthenticateUser(req: Request & { user?: UserJwtPayload }, _res: Response, next: NextFunction) {
  const token = extractBearerToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET, { audience: USER_AUDIENCE }) as UserJwtPayload;
    } catch {
      // Anonymous request: ignore an invalid or expired token.
    }
  }
  next();
}

export function authenticateUser(req: Request & { user?: UserJwtPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { audience: USER_AUDIENCE }) as UserJwtPayload;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired authentication token' });
  }
}

export function authenticateAdmin(req: Request & { admin?: AdminJwtPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Admin authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { audience: ADMIN_AUDIENCE }) as AdminJwtPayload;
    if (decoded.role !== 'super_admin' && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient administrative privileges' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired admin session token' });
  }
}
