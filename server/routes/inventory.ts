import { Router, Response } from 'express';
import { queryAll, queryOne, execute, transaction } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Get Low Stock Items & Proactive Reorder Alerts
router.get('/low-stock', (req: AuthRequest, res: Response) => {
  const { store_id, filter, search, category_id } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';

  let sql = `
    SELECT
      p.id, p.code, p.sku, p.name, p.pack_size, p.unit, p.hsn_code, p.gst_rate,
      p.purchase_price, p.mrp, p.selling_price,
      p.min_stock, p.reorder_level, p.reorder_qty, p.max_stock,
      p.product_type, p.crop, p.category_id,
      c.name as category_name,
      b.name as brand_name,
      COALESCE((
        SELECT SUM(pb.current_qty)
        FROM product_batches pb
        WHERE pb.product_id = p.id AND pb.store_id = ? AND pb.is_active = 1
      ), 0) as current_stock,
      (
        SELECT s.id
        FROM product_batches pb2
        JOIN suppliers s ON pb2.supplier_id = s.id
        WHERE pb2.product_id = p.id AND pb2.supplier_id IS NOT NULL
        ORDER BY pb2.created_at DESC LIMIT 1
      ) as supplier_id,
      (
        SELECT s.company_name
        FROM product_batches pb2
        JOIN suppliers s ON pb2.supplier_id = s.id
        WHERE pb2.product_id = p.id AND pb2.supplier_id IS NOT NULL
        ORDER BY pb2.created_at DESC LIMIT 1
      ) as supplier_name,
      (
        SELECT s.mobile
        FROM product_batches pb2
        JOIN suppliers s ON pb2.supplier_id = s.id
        WHERE pb2.product_id = p.id AND pb2.supplier_id IS NOT NULL
        ORDER BY pb2.created_at DESC LIMIT 1
      ) as supplier_mobile,
      (
        SELECT s.email
        FROM product_batches pb2
        JOIN suppliers s ON pb2.supplier_id = s.id
        WHERE pb2.product_id = p.id AND pb2.supplier_id IS NOT NULL
        ORDER BY pb2.created_at DESC LIMIT 1
      ) as supplier_email,
      (
        SELECT s.address
        FROM product_batches pb2
        JOIN suppliers s ON pb2.supplier_id = s.id
        WHERE pb2.product_id = p.id AND pb2.supplier_id IS NOT NULL
        ORDER BY pb2.created_at DESC LIMIT 1
      ) as supplier_address,
      (
        SELECT s.city
        FROM product_batches pb2
        JOIN suppliers s ON pb2.supplier_id = s.id
        WHERE pb2.product_id = p.id AND pb2.supplier_id IS NOT NULL
        ORDER BY pb2.created_at DESC LIMIT 1
      ) as supplier_city
    FROM products p
    JOIN categories c ON p.category_id = c.id
    LEFT JOIN brands b ON p.brand_id = b.id
    WHERE p.is_active = 1
  `;
  const params: any[] = [storeId];

  if (category_id) {
    sql += ` AND (p.category_id = ? OR c.parent_id = ?)`;
    params.push(category_id, category_id);
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    const s = `%${search.trim()}%`;
    sql += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.sku LIKE ? OR b.name LIKE ? OR c.name LIKE ?)`;
    params.push(s, s, s, s, s);
  }

  const allProducts = queryAll(sql, params);

  // Filter and enrich low stock items
  const items = allProducts
    .map((p: any) => {
      const minStock = Number(p.min_stock) || 10;
      const reorderLevel = Number(p.reorder_level) || Math.max(minStock, 15);
      const configuredReorderQty = Number(p.reorder_qty) || 20;
      const currentStock = Number(p.current_stock) || 0;
      const purchasePrice = Number(p.purchase_price) || 0;

      const shortageQty = Math.max(0, minStock - currentStock);
      // Suggested order qty: at least configured reorder qty or enough to reach max_stock/target reserve
      const suggestedReorderQty = Math.max(
        configuredReorderQty,
        Math.max(shortageQty, Math.ceil(minStock * 1.5 - currentStock))
      );
      const estReorderCost = suggestedReorderQty * purchasePrice;

      let urgency: 'OUT_OF_STOCK' | 'BELOW_MINIMUM' | 'NEAR_REORDER' | 'NORMAL' = 'NORMAL';
      if (currentStock <= 0) {
        urgency = 'OUT_OF_STOCK';
      } else if (currentStock <= minStock) {
        urgency = 'BELOW_MINIMUM';
      } else if (currentStock <= reorderLevel) {
        urgency = 'NEAR_REORDER';
      }

      return {
        ...p,
        min_stock: minStock,
        reorder_level: reorderLevel,
        current_stock: currentStock,
        shortage_qty: shortageQty,
        suggested_reorder_qty: suggestedReorderQty,
        est_reorder_cost: estReorderCost,
        urgency
      };
    })
    .filter((p: any) => {
      if (filter === 'out_of_stock') {
        return p.urgency === 'OUT_OF_STOCK';
      }
      if (filter === 'below_min') {
        return p.urgency === 'OUT_OF_STOCK' || p.urgency === 'BELOW_MINIMUM';
      }
      if (filter === 'near_reorder') {
        return p.urgency === 'NEAR_REORDER';
      }
      // default: return all reorder alerts (out of stock, below min, or at reorder level)
      return p.urgency !== 'NORMAL';
    })
    .sort((a: any, b: any) => {
      // Sort priority: Out of stock first, then below min, then by shortage amount descending
      const score = (item: any) => {
        if (item.urgency === 'OUT_OF_STOCK') return 1;
        if (item.urgency === 'BELOW_MINIMUM') return 2;
        return 3;
      };
      const diff = score(a) - score(b);
      if (diff !== 0) return diff;
      return (b.shortage_qty - a.shortage_qty) || (a.current_stock - b.current_stock);
    });

  // Calculate overall summary counts
  const allAlertProducts = allProducts.map((p: any) => {
    const minStock = Number(p.min_stock) || 10;
    const reorderLevel = Number(p.reorder_level) || Math.max(minStock, 15);
    const currentStock = Number(p.current_stock) || 0;
    const purchasePrice = Number(p.purchase_price) || 0;
    const suggestedReorderQty = Math.max(Number(p.reorder_qty) || 20, Math.max(minStock - currentStock, 10));

    let urgency = 'NORMAL';
    if (currentStock <= 0) urgency = 'OUT_OF_STOCK';
    else if (currentStock <= minStock) urgency = 'BELOW_MINIMUM';
    else if (currentStock <= reorderLevel) urgency = 'NEAR_REORDER';

    return {
      urgency,
      estCost: suggestedReorderQty * purchasePrice,
      isBelowMin: currentStock <= minStock,
      isOutOfStock: currentStock <= 0
    };
  });

  const outOfStockCount = allAlertProducts.filter(p => p.urgency === 'OUT_OF_STOCK').length;
  const belowMinCount = allAlertProducts.filter(p => p.urgency === 'BELOW_MINIMUM').length;
  const nearReorderCount = allAlertProducts.filter(p => p.urgency === 'NEAR_REORDER').length;
  const totalLowStockCount = outOfStockCount + belowMinCount;
  const totalAlertsCount = totalLowStockCount + nearReorderCount;
  const totalEstReorderCost = allAlertProducts
    .filter(p => p.urgency !== 'NORMAL')
    .reduce((sum, p) => sum + p.estCost, 0);

  res.json({
    items,
    summary: {
      outOfStockCount,
      belowMinCount,
      nearReorderCount,
      totalLowStockCount,
      totalAlertsCount,
      totalEstReorderCost
    }
  });
});

// Get Batch & Expiry Watch list with configurable threshold
router.get('/batches', (req: AuthRequest, res: Response) => {
  const { store_id, days } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';
  const thresholdDays = Number(days) || 90;

  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + thresholdDays);

  const todayStr = today.toISOString().split('T')[0];
  const futureStr = futureDate.toISOString().split('T')[0];

  const batches = queryAll(`
    SELECT b.*, p.name as product_name, p.code as product_code, p.unit, p.hsn_code,
           s.company_name as supplier_name
    FROM product_batches b
    JOIN products p ON b.product_id = p.id
    LEFT JOIN suppliers s ON b.supplier_id = s.id
    WHERE b.store_id = ? AND b.current_qty > 0
    ORDER BY b.expiry_date ASC
  `, [storeId]);

  const expired = batches.filter(b => b.expiry_date < todayStr);
  const expiringSoon = batches.filter(b => b.expiry_date >= todayStr && b.expiry_date <= futureStr);

  res.json({
    allBatches: batches,
    expired,
    expiringSoon,
    thresholdDays
  });
});

// Inventory movements history
router.get('/movements', (req: AuthRequest, res: Response) => {
  const { store_id, product_id } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';

  let sql = `
    SELECT it.*, p.name as product_name, p.code as product_code, p.hsn_code, b.batch_number
    FROM inventory_transactions it
    JOIN products p ON it.product_id = p.id
    LEFT JOIN product_batches b ON it.batch_id = b.id
    WHERE it.store_id = ?
  `;
  const params: any[] = [storeId];

  if (product_id) {
    sql += " AND it.product_id = ?";
    params.push(product_id);
  }

  sql += " ORDER BY it.created_at DESC LIMIT 200";
  const movements = queryAll(sql, params);
  res.json({ movements });
});

// Stock Adjustments (Damage, Loss, Expiry, Mismatch)
router.get('/adjustments', (req: AuthRequest, res: Response) => {
  const { store_id } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';

  const adjustments = queryAll(`
    SELECT sa.*, p.name as product_name, p.code as product_code, p.hsn_code, p.unit, b.batch_number
    FROM stock_adjustments sa
    JOIN products p ON sa.product_id = p.id
    LEFT JOIN product_batches b ON sa.batch_id = b.id
    WHERE sa.store_id = ?
    ORDER BY sa.created_at DESC
  `, [storeId]);

  res.json({ adjustments });
});

router.post('/adjustments', requirePermission('inventory:adjust'), (req: AuthRequest, res: Response) => {
  const { product_id, batch_id, physical_qty, reason, remarks } = req.body;
  const storeId = req.user!.storeId || 'store-main';

  if (!product_id || !batch_id || physical_qty === undefined || !reason) {
    return res.status(400).json({ error: 'Product, batch, physical quantity, and reason are required.' });
  }

  const batch = queryOne("SELECT * FROM product_batches WHERE id = ?", [batch_id]);
  if (!batch) return res.status(404).json({ error: 'Batch not found.' });

  const systemQty = batch.current_qty;
  const physQty = Number(physical_qty);
  const diff = physQty - systemQty;

  const adjNumber = `ADJ-${Date.now()}`;
  const adjId = `adj-${Date.now()}`;

  transaction(() => {
    // 1. Create adjustment record
    execute(`
      INSERT INTO stock_adjustments (
        id, adjustment_number, store_id, product_id, batch_id, system_qty, physical_qty, difference, reason, remarks, approved_by, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [adjId, adjNumber, storeId, product_id, batch_id, systemQty, physQty, diff, reason, remarks || null, req.user!.username, req.user!.username]);

    // 2. Update batch current quantity
    execute("UPDATE product_batches SET current_qty = ? WHERE id = ?", [physQty, batch_id]);

    // 3. Log inventory movement
    const movementType = diff < 0 ? (reason === 'Expiry' ? 'Expiry' : 'Damage') : 'Adjustment';
    execute(`
      INSERT INTO inventory_transactions (
        id, store_id, product_id, batch_id, movement_type, reference_type, reference_id,
        quantity, unit, previous_qty, new_qty, user_id, notes
      ) VALUES (?, ?, ?, ?, ?, 'StockAdjustment', ?, ?, ?, ?, ?, ?, ?)
    `, [
      `itx-${Date.now()}`, storeId, product_id, batch_id, movementType, adjId,
      Math.abs(diff), 'Units', systemQty, physQty, req.user!.id, `Stock Adjustment (${reason}): ${remarks || ''}`
    ]);
  });

  logAudit(req.user!.id, req.user!.username, storeId, 'STOCK_ADJUSTMENT', 'StockAdjustment', adjId, { systemQty }, { physQty, diff, reason });
  res.status(201).json({ message: 'Stock adjustment saved successfully.', adjNumber, difference: diff });
});

// Inter-Store Stock Transfers Workflow (Requested -> Approved -> Dispatched -> Received)
router.get('/transfers', (req: AuthRequest, res: Response) => {
  const transfers = queryAll(`
    SELECT st.*, fs.name as from_store_name, ts.name as to_store_name
    FROM stock_transfers st
    JOIN stores fs ON st.from_store_id = fs.id
    JOIN stores ts ON st.to_store_id = ts.id
    ORDER BY st.created_at DESC
  `);
  res.json({ transfers });
});

router.post('/transfers', requirePermission('inventory:transfer'), (req: AuthRequest, res: Response) => {
  const { from_store_id, to_store_id, items, notes } = req.body;

  if (!from_store_id || !to_store_id || from_store_id === to_store_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Valid source store, destination store, and at least one item are required.' });
  }

  const transferNumber = `STR-${Date.now()}`;
  const transferId = `str-${Date.now()}`;

  transaction(() => {
    execute(`
      INSERT INTO stock_transfers (id, transfer_number, from_store_id, to_store_id, status, notes, created_by)
      VALUES (?, ?, ?, ?, 'Dispatched', ?, ?)
    `, [transferId, transferNumber, from_store_id, to_store_id, notes || null, req.user!.username]);

    for (const item of items) {
      const batch = queryOne("SELECT * FROM product_batches WHERE id = ?", [item.batch_id]);
      if (!batch || batch.current_qty < item.quantity) {
        throw new Error(`Insufficient stock in batch for transfer.`);
      }

      // Deduct from source batch
      execute("UPDATE product_batches SET current_qty = current_qty - ? WHERE id = ?", [item.quantity, item.batch_id]);

      // Add to transfer items
      execute(`
        INSERT INTO stock_transfer_items (id, transfer_id, product_id, batch_id, quantity, unit)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [`stri-${Date.now()}-${Math.random()}`, transferId, item.product_id, item.batch_id, item.quantity, item.unit || 'Units']);

      // Log source transfer out
      execute(`
        INSERT INTO inventory_transactions (
          id, store_id, product_id, batch_id, movement_type, reference_type, reference_id, quantity, unit, user_id, notes
        ) VALUES (?, ?, ?, ?, 'TransferOut', 'StockTransfer', ?, ?, ?, ?, ?)
      `, [`itx-${Date.now()}-${Math.random()}`, from_store_id, item.product_id, item.batch_id, transferId, item.quantity, item.unit || 'Units', req.user!.id, `Transferred to Store ${to_store_id}`]);

      // Create/Increase batch in destination store
      let destBatch = queryOne("SELECT * FROM product_batches WHERE product_id = ? AND batch_number = ? AND store_id = ?", [item.product_id, batch.batch_number, to_store_id]);
      if (destBatch) {
        execute("UPDATE product_batches SET current_qty = current_qty + ? WHERE id = ?", [item.quantity, destBatch.id]);
      } else {
        execute(`
          INSERT INTO product_batches (
            id, product_id, batch_number, store_id, mfg_date, expiry_date, supplier_id, purchase_price, mrp, initial_qty, current_qty
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [`batch-${Date.now()}-${Math.random()}`, item.product_id, batch.batch_number, to_store_id, batch.mfg_date, batch.expiry_date, batch.supplier_id, batch.purchase_price, batch.mrp, item.quantity, item.quantity]);
      }
    }
  });

  logAudit(req.user!.id, req.user!.username, from_store_id, 'STOCK_TRANSFER', 'StockTransfer', transferId, null, { transferNumber, to_store_id });
  res.status(201).json({ message: 'Stock transfer dispatched successfully.', transferNumber });
});

// Delete or write-off obsolete/expired batch
router.delete('/batches/:id', requirePermission('inventory:manage'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const batch = queryOne("SELECT * FROM product_batches WHERE id = ?", [id]);
  if (!batch) return res.status(404).json({ error: 'Batch not found.' });

  transaction(() => {
    // 1. Delete associated inventory movement records and adjustments
    execute("DELETE FROM inventory_transactions WHERE batch_id = ?", [id]);
    execute("DELETE FROM stock_adjustments WHERE batch_id = ?", [id]);
    execute("DELETE FROM stock_transfer_items WHERE batch_id = ?", [id]);
    execute("DELETE FROM held_bill_items WHERE batch_id = ?", [id]);
    // 2. Delete batch record
    execute("DELETE FROM product_batches WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, batch.store_id || req.user!.storeId, 'DELETE_BATCH', 'ProductBatch', id, batch, null);
  res.json({ message: `Batch ${batch.batch_number} and all transaction logs have been deleted.` });
});

export default router;
