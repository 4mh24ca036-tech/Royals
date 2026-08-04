import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import {describe, expect, it} from 'vitest';
import {
  authenticateAdmin,
  authenticateUser,
  generateAdminToken,
  generateUserToken,
  type AdminJwtPayload,
  type UserJwtPayload
} from '../../server/auth';

const SECRET = process.env.JWT_SECRET as string;

const userPayload: UserJwtPayload = {
  id: 'usr_1',
  email: 'customer@royals.com',
  name: 'Princess Gayatri',
  role: 'customer'
};

const adminPayload: AdminJwtPayload = {
  id: 'adm_1',
  username: 'admin',
  email: 'admin@royals.com',
  name: 'Atelier Director',
  role: 'super_admin'
};

function userApp() {
  const app = express();
  app.get('/protected', authenticateUser, (req: any, res) => res.json({user: req.user}));
  return app;
}

function adminApp() {
  const app = express();
  app.get('/protected', authenticateAdmin, (req: any, res) => res.json({admin: req.admin}));
  return app;
}

describe('token generation', () => {
  it('signs a customer token valid for 7 days', () => {
    const decoded = jwt.verify(generateUserToken(userPayload), SECRET) as any;
    expect(decoded).toMatchObject(userPayload);
    expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60);
  });

  it('signs an admin token valid for 1 day', () => {
    const decoded = jwt.verify(generateAdminToken(adminPayload), SECRET) as any;
    expect(decoded).toMatchObject(adminPayload);
    expect(decoded.exp - decoded.iat).toBe(24 * 60 * 60);
  });
});

describe('authenticateUser', () => {
  it('rejects a request without an Authorization header', async () => {
    const res = await request(userApp()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('rejects a non-Bearer Authorization scheme', async () => {
    const res = await request(userApp()).get('/protected').set('Authorization', 'Basic abc');
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with a different secret', async () => {
    const forged = jwt.sign(userPayload, 'not_the_secret');
    const res = await request(userApp()).get('/protected').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Invalid or expired authentication token');
  });

  it('rejects an expired token', async () => {
    const expired = jwt.sign(userPayload, SECRET, {expiresIn: '-1s'});
    const res = await request(userApp()).get('/protected').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(403);
  });

  it('attaches the decoded payload for a valid token', async () => {
    const res = await request(userApp())
      .get('/protected')
      .set('Authorization', `Bearer ${generateUserToken(userPayload)}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject(userPayload);
  });
});

describe('authenticateAdmin', () => {
  it('rejects a missing header with an admin-specific message', async () => {
    const res = await request(adminApp()).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Admin authentication required');
  });

  it('rejects a valid token whose role is not administrative', async () => {
    const token = generateAdminToken({...adminPayload, role: 'customer'});
    const res = await request(adminApp()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient administrative privileges');
  });

  it.each(['admin', 'super_admin'])('accepts the %s role', async (role) => {
    const token = generateAdminToken({...adminPayload, role});
    const res = await request(adminApp()).get('/protected').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.admin.role).toBe(role);
  });

  it('rejects a malformed token', async () => {
    const res = await request(adminApp()).get('/protected').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Invalid or expired admin session token');
  });
});
