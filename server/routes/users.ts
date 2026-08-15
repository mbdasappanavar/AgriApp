import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { queryAll, queryOne, execute, transaction } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

// Get users list
router.get('/', requirePermission('users:manage'), (req: AuthRequest, res: Response) => {
  const users = queryAll(`
    SELECT u.id, u.name, u.username, u.email, u.mobile, u.role_id, u.store_id, u.is_active, u.created_at,
           r.name as role_name, r.code as role_code, s.name as store_name
    FROM users u
    JOIN roles r ON u.role_id = r.id
    LEFT JOIN stores s ON u.store_id = s.id
    ORDER BY u.created_at DESC
  `);
  res.json({ users });
});

// Create user
router.post('/', requirePermission('users:manage'), (req: AuthRequest, res: Response) => {
  const { name, username, email, mobile, password, role_id, store_id } = req.body;
  if (!name || !username || !password || !role_id) {
    return res.status(400).json({ error: 'Name, username, password, and role are required.' });
  }

  const existing = queryOne("SELECT id FROM users WHERE username = ?", [username]);
  if (existing) {
    return res.status(400).json({ error: 'Username already exists.' });
  }

  const id = `usr-${Date.now()}`;
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(password, salt);

  execute(`
    INSERT INTO users (id, name, username, email, mobile, password_hash, role_id, store_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, name, username, email || null, mobile || null, hash, role_id, store_id || null]);

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'CREATE_USER', 'User', id, null, { username, name, role_id });
  res.status(201).json({ message: 'User created successfully.', userId: id });
});

// Update user
router.put('/:id', requirePermission('users:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { name, email, mobile, role_id, store_id, is_active, password } = req.body;

  const user = queryOne("SELECT * FROM users WHERE id = ?", [id]);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  let passHash = user.password_hash;
  if (password && password.trim() !== '') {
    const salt = bcrypt.genSaltSync(10);
    passHash = bcrypt.hashSync(password, salt);
  }

  execute(`
    UPDATE users
    SET name = ?, email = ?, mobile = ?, role_id = ?, store_id = ?, is_active = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `, [name, email || null, mobile || null, role_id, store_id || null, is_active ? 1 : 0, passHash, id]);

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'UPDATE_USER', 'User', id, user, { name, role_id, is_active });
  res.json({ message: 'User updated successfully.' });
});

// Get roles and permissions
router.get('/roles', (req: AuthRequest, res: Response) => {
  const roles = queryAll("SELECT * FROM roles ORDER BY name");
  const permissions = queryAll("SELECT * FROM permissions ORDER BY category, name");

  const rolePermissions = queryAll("SELECT * FROM role_permissions");

  const result = roles.map(r => ({
    ...r,
    permissions: rolePermissions.filter(rp => rp.role_id === r.id).map(rp => rp.permission_code)
  }));

  res.json({ roles: result, allPermissions: permissions });
});

// Update role permissions
router.put('/roles/:id/permissions', requirePermission('users:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { permissions } = req.body; // array of permission_code

  if (!Array.isArray(permissions)) {
    return res.status(400).json({ error: 'Permissions must be an array of codes.' });
  }

  transaction(() => {
    execute("DELETE FROM role_permissions WHERE role_id = ?", [id]);
    for (const code of permissions) {
      execute("INSERT INTO role_permissions (role_id, permission_code) VALUES (?, ?)", [id, code]);
    }
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'UPDATE_ROLE_PERMISSIONS', 'Role', id, null, permissions);
  res.json({ message: 'Role permissions updated successfully.' });
});

// Delete user account
router.delete('/:id', requirePermission('users:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  if (id === req.user!.id) {
    return res.status(400).json({ error: 'You cannot delete your own currently logged-in account.' });
  }

  const user = queryOne("SELECT * FROM users WHERE id = ?", [id]);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  transaction(() => {
    execute("DELETE FROM users WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'DELETE_USER', 'User', id, user, null);
  res.json({ message: `User "${user.name}" (${user.username}) deleted successfully.` });
});

export default router;
