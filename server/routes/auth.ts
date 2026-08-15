import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryOne, queryAll } from '../db/database';
import { generateToken, authMiddleware, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const user = queryOne(`
    SELECT u.*, r.name as role_name, r.code as role_code, s.name as store_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN stores s ON u.store_id = s.id
    WHERE u.username = ? OR u.mobile = ?
  `, [username, username]);

  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid username or password, or user account disabled.' });
  }

  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  // Load permissions for user
  let permCodes: string[] = [];
  if (user.role_code === 'SUPER_ADMIN') {
    const allPerms = queryAll("SELECT code FROM permissions");
    permCodes = allPerms.map(p => p.code);
  } else {
    // Role permissions
    const rolePerms = queryAll("SELECT permission_code FROM role_permissions WHERE role_id = ?", [user.role_id]);
    permCodes = rolePerms.map(p => p.permission_code);

    // User overrides
    const overrides = queryAll("SELECT permission_code, is_granted FROM user_permissions WHERE user_id = ?", [user.id]);
    for (const ov of overrides) {
      if (ov.is_granted && !permCodes.includes(ov.permission_code)) {
        permCodes.push(ov.permission_code);
      } else if (!ov.is_granted) {
        permCodes = permCodes.filter(c => c !== ov.permission_code);
      }
    }
  }

  const payload = {
    id: user.id,
    username: user.username,
    name: user.name,
    roleId: user.role_id,
    roleName: user.role_name,
    roleCode: user.role_code,
    storeId: user.store_id || 'store-main',
    storeName: user.store_name || 'Hubballi Main Hub',
    permissions: permCodes
  };

  const token = generateToken(payload);
  logAudit(user.id, user.username, user.store_id, 'LOGIN', 'User', user.id);

  res.json({
    message: 'Login successful',
    token,
    user: payload
  });
});

router.get('/me', authMiddleware, (req: AuthRequest, res: Response) => {
  res.json({ user: req.user });
});

router.post('/change-password', authMiddleware, (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  const user = queryOne("SELECT * FROM users WHERE id = ?", [req.user!.id]);
  if (!user || !bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const newHash = bcrypt.hashSync(newPassword, salt);
  queryOne("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, req.user!.id]);

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'CHANGE_PASSWORD', 'User', req.user!.id);
  res.json({ message: 'Password changed successfully.' });
});

export default router;
