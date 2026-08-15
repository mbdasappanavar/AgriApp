import { Router, Response } from 'express';
import { queryAll } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/audit-logs', requirePermission('audit:view'), (req: AuthRequest, res: Response) => {
  const logs = queryAll("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500");
  res.json({ auditLogs: logs });
});

router.get('/notifications', (req: AuthRequest, res: Response) => {
  const storeId = req.user!.storeId || 'store-main';
  const todayStr = new Date().toISOString().split('T')[0];

  // Auto generate low stock & expiry warnings
  const lowStock = queryAll(`
    SELECT p.name, p.code, COALESCE(SUM(pb.current_qty), 0) as stock, p.reorder_level
    FROM products p
    LEFT JOIN product_batches pb ON p.id = pb.product_id AND pb.store_id = ?
    GROUP BY p.id
    HAVING stock <= p.reorder_level
  `, [storeId]);

  const expiredBatches = queryAll(`
    SELECT p.name, pb.batch_number, pb.expiry_date, pb.current_qty
    FROM product_batches pb
    JOIN products p ON pb.product_id = p.id
    WHERE pb.store_id = ? AND pb.current_qty > 0 AND pb.expiry_date < ?
  `, [storeId, todayStr]);

  const overdueCredit = queryAll(`
    SELECT name, village, current_outstanding, credit_limit
    FROM customers
    WHERE current_outstanding > credit_limit
  `);

  res.json({
    notifications: [
      ...lowStock.map(l => ({ id: `ls-${l.code}`, type: 'LOW_STOCK', level: 'warning', title: `Low Stock: ${l.name}`, message: `Current stock (${l.stock}) is at or below reorder level (${l.reorder_level}).` })),
      ...expiredBatches.map(e => ({ id: `exp-${e.batch_number}`, type: 'EXPIRED_BATCH', level: 'error', title: `Expired Product: ${e.name}`, message: `Batch ${e.batch_number} expired on ${e.expiry_date}. Qty: ${e.current_qty}` })),
      ...overdueCredit.map(c => ({ id: `cred-${c.name}`, type: 'CREDIT_LIMIT_EXCEEDED', level: 'warning', title: `Credit Limit Exceeded: ${c.name}`, message: `Outstanding ₹${c.current_outstanding} exceeds limit ₹${c.credit_limit}.` }))
    ]
  });
});

export default router;
