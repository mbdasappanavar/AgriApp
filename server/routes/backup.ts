import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';
import { execute, queryAll, transaction } from '../db/database';

const router = Router();
router.use(authMiddleware);

// Export Backup DB
router.get('/backup/export', requirePermission('backup:manage'), (req: AuthRequest, res: Response) => {
  const dbPath = path.join(process.cwd(), 'data', 'agri_store.db');
  if (!fs.existsSync(dbPath)) {
    return res.status(404).json({ error: 'Database backup file not found.' });
  }

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'EXPORT_DATABASE_BACKUP', 'Database', 'agri_store.db');
  res.download(dbPath, `agri_store_backup_${Date.now()}.db`);
});

// CSV/Excel Import preview and bulk insert for Products
router.post('/import/products', requirePermission('products:manage'), (req: AuthRequest, res: Response) => {
  const { products } = req.body;
  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ error: 'At least one product record is required.' });
  }

  const successList: any[] = [];
  const errorsList: any[] = [];

  transaction(() => {
    let count = 0;
    for (const p of products) {
      try {
        if (!p.name || !p.code || !p.sku) {
          errorsList.push({ product: p, reason: 'Missing name, code or SKU' });
          continue;
        }

        const pid = `prod-imp-${Date.now()}-${count++}`;
        const catId = p.category_id || 'cat-seeds-paddy';
        const hsn = p.hsn_code || '1209';
        const gst = Number(p.gst_rate) || 18;
        const buy = Number(p.purchase_price) || 0;
        const sell = Number(p.selling_price) || 0;
        const mrpVal = Number(p.mrp) || sell;

        execute(`
          INSERT INTO products (
            id, code, sku, name, category_id, product_type, unit, purchase_price, mrp, selling_price, hsn_code, gst_rate, cgst, sgst, igst
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [pid, p.code, p.sku, p.name, catId, p.product_type || 'Seed', p.unit || 'Kg', buy, mrpVal, sell, hsn, gst, gst/2, gst/2, gst]);

        // Primary barcode
        const barcodeVal = p.barcode || `890${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        execute("INSERT INTO product_barcodes (id, product_id, barcode, is_primary) VALUES (?, ?, ?, 1)", [`bc-${pid}`, pid, barcodeVal]);

        successList.push({ code: p.code, name: p.name });
      } catch (err: any) {
        errorsList.push({ product: p, reason: err.message });
      }
    }
  });

  logAudit(req.user!.id, req.user!.username, req.user!.storeId, 'IMPORT_PRODUCTS', 'Product', null, null, { importedCount: successList.length });
  res.json({
    message: `Import processed. Successfully imported ${successList.length} products. ${errorsList.length} failed.`,
    successCount: successList.length,
    failedCount: errorsList.length,
    errors: errorsList
  });
});

export default router;
