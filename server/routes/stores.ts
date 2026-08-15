import { Router, Response } from 'express';
import { queryAll, queryOne, execute } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// List stores
router.get('/stores', (req: AuthRequest, res: Response) => {
  const stores = queryAll("SELECT * FROM stores ORDER BY name");
  res.json({ stores });
});

// Create store
router.post('/stores', requirePermission('settings:manage'), (req: AuthRequest, res: Response) => {
  const { name, code, address, city, state, pin, phone, email, gstin } = req.body;
  if (!name || !code) {
    return res.status(400).json({ error: 'Store name and unique store code are required.' });
  }

  const existing = queryOne("SELECT id FROM stores WHERE code = ?", [code]);
  if (existing) {
    return res.status(400).json({ error: 'Store code already exists.' });
  }

  const id = `store-${Date.now()}`;
  execute(`
    INSERT INTO stores (id, name, code, address, city, state, pin, phone, email, gstin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, name, code, address, city, state || 'Karnataka', pin, phone, email, gstin]);

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'CREATE_STORE', 'Store', id, null, { name, code });
  res.status(201).json({ message: 'Store branch created successfully.', storeId: id });
});

// Company settings
router.get('/company', (req: AuthRequest, res: Response) => {
  const company = queryOne("SELECT * FROM company_settings WHERE id = 1");
  res.json({ company });
});

router.put('/company', requirePermission('settings:manage'), (req: AuthRequest, res: Response) => {
  const {
    business_name, legal_name, address, phone, email, pan, gstin, state, state_code,
    financial_year, currency, invoice_prefix, po_prefix, pr_prefix, terms_and_conditions, bank_details
  } = req.body;

  execute(`
    UPDATE company_settings
    SET business_name = ?, legal_name = ?, address = ?, phone = ?, email = ?, pan = ?, gstin = ?,
        state = ?, state_code = ?, financial_year = ?, currency = ?, invoice_prefix = ?, po_prefix = ?, pr_prefix = ?,
        terms_and_conditions = ?, bank_details = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `, [
    business_name, legal_name, address, phone, email, pan, gstin, state || 'Karnataka', state_code || '29',
    financial_year || '2026-2027', currency || '₹', invoice_prefix || 'INV-', po_prefix || 'PO-', pr_prefix || 'PR-',
    terms_and_conditions, bank_details
  ]);

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'UPDATE_COMPANY_SETTINGS', 'CompanySettings', '1');
  res.json({ message: 'Company settings updated successfully.' });
});

export default router;
