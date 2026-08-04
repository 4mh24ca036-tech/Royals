import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const JWT_SECRET = process.env.JWT_SECRET || 'ROYALS_HAUTE_COUTURE_SECRET_KEY_2026';

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

export function generateUserToken(payload: UserJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function generateAdminToken(payload: AdminJwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1d' });
}

export function authenticateUser(req: Request & { user?: UserJwtPayload }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserJwtPayload;
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
    const decoded = jwt.verify(token, JWT_SECRET) as AdminJwtPayload;
    if (decoded.role !== 'super_admin' && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient administrative privileges' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired admin session token' });
  }
}
