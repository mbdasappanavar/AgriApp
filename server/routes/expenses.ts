import { Router, Response } from 'express';
import { queryAll, queryOne, execute } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

router.get('/', (req: AuthRequest, res: Response) => {
  const storeId = req.user!.storeId || 'store-main';
  const expenses = queryAll("SELECT * FROM expenses WHERE store_id = ? ORDER BY expense_date DESC", [storeId]);
  res.json({ expenses });
});

router.post('/', requirePermission('expenses:manage'), (req: AuthRequest, res: Response) => {
  const { category, vendor_name, description, amount, payment_mode, expense_date } = req.body;
  const storeId = req.user!.storeId || 'store-main';

  const expAmt = Number(amount);
  if (!category || isNaN(expAmt) || expAmt <= 0) {
    return res.status(400).json({ error: 'Expense category and valid positive amount are required.' });
  }

  const expenseNumber = `EXP-${Date.now()}`;
  const id = `exp-${Date.now()}`;

  execute(`
    INSERT INTO expenses (id, expense_number, store_id, category, vendor_name, description, amount, payment_mode, expense_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [id, expenseNumber, storeId, category, vendor_name || null, description || null, expAmt, payment_mode || 'Cash', expense_date || new Date().toISOString().split('T')[0], req.user!.username]);

  // Update cash register if cash
  if ((payment_mode || 'Cash').toLowerCase() === 'cash') {
    execute(`
      UPDATE cash_registers
      SET cash_expenses = cash_expenses + ?, expected_closing_cash = expected_closing_cash - ?
      WHERE store_id = ? AND status = 'Open'
    `, [expAmt, expAmt, storeId]);
  }

  logAudit(req.user!.id, req.user!.username, storeId, 'CREATE_EXPENSE', 'Expense', id, null, { category, amount: expAmt });
  res.status(201).json({ message: 'Expense recorded successfully.', expenseNumber });
});

router.delete('/:id', requirePermission('expenses:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const storeId = req.user!.storeId || 'store-main';
  const expense = queryOne("SELECT * FROM expenses WHERE id = ?", [id]);
  if (!expense) return res.status(404).json({ error: 'Expense record not found.' });

  // If paid in cash, revert cash register
  if ((expense.payment_mode || 'Cash').toLowerCase() === 'cash') {
    execute(`
      UPDATE cash_registers
      SET cash_expenses = MAX(0, cash_expenses - ?), expected_closing_cash = expected_closing_cash + ?
      WHERE store_id = ? AND status = 'Open'
    `, [expense.amount, expense.amount, storeId]);
  }

  execute("DELETE FROM expenses WHERE id = ?", [id]);

  logAudit(req.user!.id, req.user!.username, storeId, 'DELETE_EXPENSE', 'Expense', id, expense, null);
  res.json({ message: `Expense voucher #${expense.expense_number} removed and cash register adjusted.` });
});

export default router;
