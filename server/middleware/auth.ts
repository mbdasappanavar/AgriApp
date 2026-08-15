import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { queryOne, queryAll, execute } from '../db/database';

const JWT_SECRET = process.env.JWT_SECRET || 'agri_retail_secret_key_2026_xyz';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    name: string;
    roleId: string;
    roleCode: string;
    storeId: string;
    permissions: string[];
  };
}

export function generateToken(userPayload: any): string {
  return jwt.sign(userPayload, JWT_SECRET, { expiresIn: '24h' });
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

export function requirePermission(permissionCode: string) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    // Super Admin & Store Manager have full access
    if (req.user.roleCode === 'SUPER_ADMIN' || req.user.roleCode === 'STORE_MANAGER') {
      return next();
    }

    if (req.user.permissions && req.user.permissions.includes(permissionCode)) {
      return next();
    }

    return res.status(403).json({
      error: `Access Denied. You do not have permission '${permissionCode}' required for this operation.`
    });
  };
}

export function logAudit(
  userId: string,
  username: string,
  storeId: string | null,
  action: string,
  entity: string,
  entityId: string | null = null,
  previousValue: any = null,
  newValue: any = null,
  ipAddress: string = '127.0.0.1'
) {
  try {
    const id = `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const prevStr = previousValue ? JSON.stringify(previousValue) : null;
    const newStr = newValue ? JSON.stringify(newValue) : null;

    execute(`
      INSERT INTO audit_logs (id, user_id, username, store_id, action, entity, entity_id, previous_value, new_value, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, userId, username, storeId, action, entity, entityId, prevStr, newStr, ipAddress]);
  } catch (err) {
    console.error('Failed to record audit log:', err);
  }
}
