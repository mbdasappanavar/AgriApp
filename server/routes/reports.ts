import { Router, Response } from 'express';
import { queryAll, queryOne } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Business Dashboard KPIs & Charts
router.get('/dashboard', (req: AuthRequest, res: Response) => {
  try {
    const storeId = req.user!.storeId || 'store-main';
    const todayStr = new Date().toISOString().split('T')[0];

    // Sales KPIs
    const todaySales = queryOne(`
      SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count, COALESCE(AVG(grand_total), 0) as avg
      FROM sales_invoices
      WHERE store_id = ? AND invoice_date = ? AND status != 'Cancelled'
    `, [storeId, todayStr]) || { total: 0, count: 0, avg: 0 };

    const monthSales = queryOne(`
      SELECT COALESCE(SUM(grand_total), 0) as total
      FROM sales_invoices
      WHERE store_id = ? AND strftime('%Y-%m', invoice_date) = strftime('%Y-%m', 'now') AND status != 'Cancelled'
    `, [storeId]) || { total: 0 };

    // Profitability KPIs
    const profitData = queryOne(`
      SELECT
        COALESCE(SUM(si.total_amount), 0) as gross_sales,
        COALESCE(SUM(si.quantity * si.cost_price), 0) as cogs
      FROM sales_items si
      JOIN sales_invoices s ON si.sales_id = s.id
      WHERE s.store_id = ? AND strftime('%Y-%m', s.invoice_date) = strftime('%Y-%m', 'now') AND s.status != 'Cancelled'
    `, [storeId]) || { gross_sales: 0, cogs: 0 };

    const monthExpenses = queryOne(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM expenses
      WHERE store_id = ? AND strftime('%Y-%m', expense_date) = strftime('%Y-%m', 'now')
    `, [storeId])?.total || 0;

    const grossSales = profitData.gross_sales || 0;
    const cogs = profitData.cogs || 0;
    const grossProfit = grossSales - cogs;
    const netProfit = grossProfit - monthExpenses;
    const marginPct = grossSales > 0 ? Number(((grossProfit / grossSales) * 100).toFixed(1)) : 0;

    // Receivables & Payables
    const totalReceivables = queryOne("SELECT COALESCE(SUM(current_outstanding), 0) as total FROM customers")?.total || 0;
    const totalPayables = queryOne("SELECT COALESCE(SUM(current_outstanding), 0) as total FROM suppliers")?.total || 0;

    // Inventory KPIs
    const invSummary = queryOne(`
      SELECT
        COUNT(DISTINCT p.id) as total_products,
        COALESCE(SUM(pb.current_qty * pb.purchase_price), 0) as total_val_cost,
        COALESCE(SUM(pb.current_qty * pb.mrp), 0) as total_val_mrp
      FROM products p
      JOIN product_batches pb ON p.id = pb.product_id
      WHERE pb.store_id = ? AND pb.current_qty > 0
    `, [storeId]) || { total_products: 0, total_val_cost: 0, total_val_mrp: 0 };

    const lowStockCount = queryOne(`
      SELECT COUNT(*) as c FROM (
        SELECT p.id, COALESCE(SUM(pb.current_qty), 0) as stock
        FROM products p
        LEFT JOIN product_batches pb ON p.id = pb.product_id AND pb.store_id = ?
        GROUP BY p.id
        HAVING stock <= p.reorder_level
      )
    `, [storeId])?.c || 0;

    const expiredCount = queryOne(`
      SELECT COUNT(*) as c FROM product_batches
      WHERE store_id = ? AND current_qty > 0 AND expiry_date < ?
    `, [storeId, todayStr])?.c || 0;

    // Sales Trend Chart Data (Last 7 days)
    const salesTrend = queryAll(`
      SELECT invoice_date as date, COALESCE(SUM(grand_total), 0) as sales
      FROM sales_invoices
      WHERE store_id = ? AND invoice_date >= DATE('now', '-7 days') AND status != 'Cancelled'
      GROUP BY invoice_date
      ORDER BY invoice_date ASC
    `, [storeId]) || [];

    // Top Products Chart
    const topProducts = queryAll(`
      SELECT si.product_name, SUM(si.quantity) as qty, SUM(si.total_amount) as revenue
      FROM sales_items si
      JOIN sales_invoices s ON si.sales_id = s.id
      WHERE s.store_id = ? AND s.status != 'Cancelled'
      GROUP BY si.product_id
      ORDER BY revenue DESC
      LIMIT 5
    `, [storeId]) || [];

    res.json({
      kpis: {
        todaySales: todaySales.total || 0,
        todayInvoices: todaySales.count || 0,
        avgInvoice: todaySales.avg || 0,
        monthSales: monthSales.total || 0,
        grossProfit,
        netProfit,
        marginPct,
        monthExpenses,
        totalReceivables,
        totalPayables,
        totalProducts: invSummary.total_products || 0,
        inventoryValuationCost: invSummary.total_val_cost || 0,
        inventoryValuationMrp: invSummary.total_val_mrp || 0,
        lowStockCount,
        expiredCount
      },
      charts: {
        salesTrend,
        topProducts
      }
    });
  } catch (err: any) {
    console.error("Dashboard calculation error:", err);
    res.status(500).json({ error: err.message || "Failed to calculate dashboard statistics" });
  }
});

// Profitability Report
router.get('/profitability', requirePermission('reports:view'), (req: AuthRequest, res: Response) => {
  const storeId = req.user!.storeId || 'store-main';

  const productProfit = queryAll(`
    SELECT
      si.product_name,
      p.code as product_code,
      c.name as category_name,
      SUM(si.quantity) as total_qty,
      SUM(si.total_amount) as total_revenue,
      SUM(si.quantity * si.cost_price) as total_cogs,
      (SUM(si.total_amount) - SUM(si.quantity * si.cost_price)) as gross_profit,
      CASE WHEN SUM(si.total_amount) > 0 THEN ((SUM(si.total_amount) - SUM(si.quantity * si.cost_price)) / SUM(si.total_amount)) * 100 ELSE 0 END as margin_pct
    FROM sales_items si
    JOIN sales_invoices s ON si.sales_id = s.id
    JOIN products p ON si.product_id = p.id
    JOIN categories c ON p.category_id = c.id
    WHERE s.store_id = ? AND s.status != 'Cancelled'
    GROUP BY si.product_id
    ORDER BY gross_profit DESC
  `, [storeId]);

  res.json({ productProfit });
});

// Aging Overdue Reports (0-30, 31-60, 61-90, 90+ days)
router.get('/aging', requirePermission('reports:view'), (req: AuthRequest, res: Response) => {
  const customers = queryAll(`
    SELECT id, customer_code, name, mobile, village, credit_limit, current_outstanding
    FROM customers
    WHERE current_outstanding > 0
    ORDER BY current_outstanding DESC
  `);

  const suppliers = queryAll(`
    SELECT id, supplier_code, company_name, contact_person, mobile, current_outstanding
    FROM suppliers
    WHERE current_outstanding > 0
    ORDER BY current_outstanding DESC
  `);

  res.json({ customerAging: customers, supplierAging: suppliers });
});

export default router;
