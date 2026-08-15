import { Router, Response } from 'express';
import { queryAll, queryOne, execute, transaction } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Daily Cash Register
router.get('/register', (req: AuthRequest, res: Response) => {
  const storeId = req.user!.storeId || 'store-main';
  const todayStr = new Date().toISOString().split('T')[0];

  let register = queryOne("SELECT * FROM cash_registers WHERE store_id = ? AND register_date = ?", [storeId, todayStr]);

  if (!register) {
    // Check previous closing
    const prev = queryOne("SELECT actual_closing_cash FROM cash_registers WHERE store_id = ? ORDER BY register_date DESC LIMIT 1", [storeId]);
    const openingCash = prev ? prev.actual_closing_cash : 5000.00;

    const regId = `reg-${Date.now()}`;
    execute(`
      INSERT INTO cash_registers (id, store_id, register_date, opening_cash, expected_closing_cash, actual_closing_cash, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Open')
    `, [regId, storeId, todayStr, openingCash, openingCash, openingCash]);

    register = queryOne("SELECT * FROM cash_registers WHERE id = ?", [regId]);
  }

  res.json({ register });
});

// Day Closing execution
router.post('/day-closing', requirePermission('day_closing:execute'), (req: AuthRequest, res: Response) => {
  const { actual_cash, notes } = req.body;
  const storeId = req.user!.storeId || 'store-main';
  const todayStr = new Date().toISOString().split('T')[0];

  const register = queryOne("SELECT * FROM cash_registers WHERE store_id = ? AND register_date = ?", [storeId, todayStr]);
  if (!register) return res.status(404).json({ error: 'Cash register for today not found.' });

  const actCash = Number(actual_cash);
  if (isNaN(actCash) || actCash < 0) {
    return res.status(400).json({ error: 'Valid physical cash amount is required for day closing.' });
  }

  // Calculate day totals
  const salesSummary = queryOne(`
    SELECT
      COALESCE(SUM(grand_total), 0) as total_sales,
      COALESCE(SUM(CASE WHEN payment_mode = 'Cash' AND is_credit_sale = 0 THEN amount_received ELSE 0 END), 0) as cash_sales,
      COALESCE(SUM(CASE WHEN payment_mode = 'UPI' THEN amount_received ELSE 0 END), 0) as upi_sales,
      COALESCE(SUM(CASE WHEN payment_mode = 'Card' THEN amount_received ELSE 0 END), 0) as card_sales,
      COALESCE(SUM(CASE WHEN is_credit_sale = 1 THEN balance_due ELSE 0 END), 0) as credit_sales
    FROM sales_invoices
    WHERE store_id = ? AND invoice_date = ? AND status != 'Cancelled'
  `, [storeId, todayStr]);

  const expenses = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE store_id = ? AND expense_date = ?", [storeId, todayStr])?.total || 0;
  const collections = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE store_id = ? AND entity_type = 'Customer' AND payment_date = ?", [storeId, todayStr])?.total || 0;
  const supplierPayments = queryOne("SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE store_id = ? AND entity_type = 'Supplier' AND payment_date = ?", [storeId, todayStr])?.total || 0;

  const expectedCash = register.opening_cash + salesSummary.cash_sales + collections - expenses - supplierPayments;
  const difference = Number((actCash - expectedCash).toFixed(2));

  const closingId = `close-${Date.now()}`;

  transaction(() => {
    // Update Register
    execute(`
      UPDATE cash_registers
      SET expected_closing_cash = ?, actual_closing_cash = ?, difference = ?, status = 'Closed', closed_at = CURRENT_TIMESTAMP, closed_by = ?
      WHERE id = ?
    `, [expectedCash, actCash, difference, req.user!.username, register.id]);

    // Insert Day Closing record
    execute(`
      INSERT INTO day_closings (
        id, store_id, closing_date, opening_cash, total_sales, cash_sales, upi_sales, card_sales, credit_sales,
        expenses, customer_collections, supplier_payments, expected_cash, actual_cash, difference, notes, status, closed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Closed', ?)
    `, [
      closingId, storeId, todayStr, register.opening_cash, salesSummary.total_sales, salesSummary.cash_sales,
      salesSummary.upi_sales, salesSummary.card_sales, salesSummary.credit_sales, expenses, collections,
      supplierPayments, expectedCash, actCash, difference, notes || null, req.user!.username
    ]);
  });

  logAudit(req.user!.id, req.user!.username, storeId, 'EXECUTE_DAY_CLOSING', 'DayClosing', closingId, null, { expectedCash, actCash, difference });
  res.json({
    message: 'Day closing completed and register locked successfully.',
    closingSummary: {
      date: todayStr,
      openingCash: register.opening_cash,
      totalSales: salesSummary.total_sales,
      cashSales: salesSummary.cash_sales,
      upiSales: salesSummary.upi_sales,
      cardSales: salesSummary.card_sales,
      creditSales: salesSummary.credit_sales,
      expenses,
      collections,
      supplierPayments,
      expectedCash,
      actualCash: actCash,
      difference
    }
  });
});

export default router;
