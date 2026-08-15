import { Router, Response } from 'express';
import { queryAll, queryOne } from '../db/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GST Summary & GSTR-1 (Sales Output Tax), GSTR-2 (Purchase Input Tax), HSN-wise breakdown
router.get('/summary', (req: AuthRequest, res: Response) => {
  const { store_id, start_date, end_date } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';

  let dateFilter = "";
  const params: any[] = [storeId];

  if (start_date) {
    dateFilter += " AND transaction_date >= ?";
    params.push(start_date);
  }
  if (end_date) {
    dateFilter += " AND transaction_date <= ?";
    params.push(end_date);
  }

  // Output GST (Sales)
  const outputGst = queryOne(`
    SELECT
      COALESCE(SUM(taxable_value), 0) as taxable,
      COALESCE(SUM(cgst), 0) as cgst,
      COALESCE(SUM(sgst), 0) as sgst,
      COALESCE(SUM(igst), 0) as igst,
      COALESCE(SUM(total_gst), 0) as total_tax
    FROM gst_transactions
    WHERE store_id = ? AND transaction_type = 'Output' ${dateFilter}
  `, params);

  // Input GST (Purchases)
  const inputGst = queryOne(`
    SELECT
      COALESCE(SUM(taxable_value), 0) as taxable,
      COALESCE(SUM(cgst), 0) as cgst,
      COALESCE(SUM(sgst), 0) as sgst,
      COALESCE(SUM(igst), 0) as igst,
      COALESCE(SUM(total_gst), 0) as total_tax
    FROM gst_transactions
    WHERE store_id = ? AND transaction_type = 'Input' ${dateFilter}
  `, params);

  // HSN-wise Sales Summary
  const hsnSummary = queryAll(`
    SELECT
      gt.hsn_code, hc.description,
      COALESCE(SUM(gt.taxable_value), 0) as taxable_value,
      COALESCE(SUM(gt.cgst), 0) as cgst,
      COALESCE(SUM(gt.sgst), 0) as sgst,
      COALESCE(SUM(gt.igst), 0) as igst,
      COALESCE(SUM(gt.total_gst), 0) as total_tax
    FROM gst_transactions gt
    LEFT JOIN hsn_codes hc ON gt.hsn_code = hc.hsn_code
    WHERE gt.store_id = ? AND gt.transaction_type = 'Output' ${dateFilter}
    GROUP BY gt.hsn_code
    ORDER BY taxable_value DESC
  `, params);

  // Net Tax Liability
  const netLiability = {
    cgst: Math.max(0, outputGst.cgst - inputGst.cgst),
    sgst: Math.max(0, outputGst.sgst - inputGst.sgst),
    igst: Math.max(0, outputGst.igst - inputGst.igst),
    total: Math.max(0, outputGst.total_tax - inputGst.total_tax)
  };

  res.json({
    outputGst,
    inputGst,
    netLiability,
    hsnSummary
  });
});

export default router;
