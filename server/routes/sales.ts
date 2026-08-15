import { Router, Response } from 'express';
import { queryAll, queryOne, execute, transaction } from '../db/database';
import { authMiddleware, requirePermission, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Get sales history with filters
router.get('/', (req: AuthRequest, res: Response) => {
  const { store_id, start_date, end_date, customer_id, category_id, search } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';

  let sql = `
    SELECT DISTINCT s.*, st.name as store_name
    FROM sales_invoices s
    JOIN stores st ON s.store_id = st.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (store_id !== 'all') {
    sql += " AND s.store_id = ?";
    params.push(storeId);
  }

  if (start_date) {
    sql += " AND s.invoice_date >= ?";
    params.push(start_date);
  }
  if (end_date) {
    sql += " AND s.invoice_date <= ?";
    params.push(end_date);
  }
  if (customer_id) {
    sql += " AND s.customer_id = ?";
    params.push(customer_id);
  }
  if (category_id && typeof category_id === 'string' && category_id.trim() !== '') {
    sql += ` AND EXISTS (
      SELECT 1 FROM sales_items si
      JOIN products p ON si.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      WHERE si.sales_id = s.id AND (p.category_id = ? OR c.parent_id = ?)
    )`;
    params.push(category_id.trim(), category_id.trim());
  }
  if (search && typeof search === 'string' && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    sql += " AND (s.invoice_number LIKE ? OR s.customer_name LIKE ? OR s.customer_mobile LIKE ?)";
    params.push(term, term, term);
  }

  sql += " ORDER BY s.created_at DESC";
  const sales = queryAll(sql, params);
  res.json({ sales });
});

// Process Sales Return (Full/Partial, Exchange, Credit Note)
router.post('/returns', (req: AuthRequest, res: Response) => {
  const user = req.user;
  if (!user) return res.status(401).json({ error: 'Unauthorized' });

  const permissions = user.permissions || [];
  const hasPerm = user.roleCode === 'super_admin' || user.roleCode === 'store_manager' || permissions.includes('sales:return') || permissions.includes('sales:view') || permissions.includes('pos:access');
  if (!hasPerm) {
    return res.status(403).json({ error: 'Permission denied: sales:return or sales access required.' });
  }

  const { sales_id, customer_id, return_type, reason, is_defective, refund_amount, items, exchange_items } = req.body;
  const storeId = req.user!.storeId || 'store-main';

  if (!sales_id) {
    return res.status(400).json({ error: 'Original sales_id is required for processing return.' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one return item must be provided.' });
  }

  const invoice = queryOne("SELECT * FROM sales_invoices WHERE id = ?", [sales_id]);
  if (!invoice) return res.status(404).json({ error: 'Original sales invoice not found.' });

  if (invoice.status === 'Cancelled') {
    return res.status(400).json({ error: 'Cannot process return for an already cancelled invoice.' });
  }

  const targetCustomerId = customer_id || invoice.customer_id;
  const returnId = `sret-${Date.now()}`;
  const countRes = queryOne("SELECT count(*) as count FROM sales_returns");
  const count = (countRes ? countRes.count : 0) + 1;
  const returnNumber = `RET-2627-${count.toString().padStart(4, '0')}`;
  const creditNoteNumber = `CN-2627-${count.toString().padStart(4, '0')}`;

  let totalTaxable = 0;
  let totalTax = 0;
  let grandTotal = 0;
  let actualRefund = 0;
  let exchangeTotal = 0;

  transaction(() => {
    // 1. Process Return Items
    for (const item of items) {
      const origItem = queryOne("SELECT * FROM sales_items WHERE id = ? AND sales_id = ?", [item.sales_item_id, sales_id]);
      if (!origItem) continue;

      const retQty = Number(item.quantity) || 0;
      if (retQty <= 0) continue;

      const lineTotal = retQty * origItem.rate;
      const lineTax = (origItem.cgst_amount + origItem.sgst_amount + origItem.igst_amount) * (retQty / origItem.quantity);
      const lineTaxable = lineTotal - lineTax;

      totalTaxable += lineTaxable;
      totalTax += lineTax;
      grandTotal += lineTotal;

      // Insert return item record
      execute(`
        INSERT INTO sales_return_items (
          id, return_id, sales_item_id, product_id, batch_id, quantity, unit, rate, total_amount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        `sri-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, returnId, origItem.id, origItem.product_id, origItem.batch_id,
        retQty, origItem.unit, origItem.rate, lineTotal
      ]);

      const isDefect = Boolean(is_defective || return_type === 'Same Defective Exchange' || return_type === 'Same Product Exchange (Defective)');

      // Restock batch if NOT defective
      if (!isDefect) {
        if (origItem.batch_id) {
          execute("UPDATE product_batches SET current_qty = current_qty + ? WHERE id = ?", [retQty, origItem.batch_id]);
        }
      }

      // Inventory transaction record for return
      execute(`
        INSERT INTO inventory_transactions (
          id, store_id, product_id, batch_id, movement_type, reference_type, reference_id,
          quantity, unit, user_id, notes
        ) VALUES (?, ?, ?, ?, ?, 'SalesReturn', ?, ?, ?, ?, ?)
      `, [
        `itx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, storeId, origItem.product_id, origItem.batch_id,
        isDefect ? 'DefectiveReturn' : 'SalesReturn', returnId,
        retQty, origItem.unit, req.user!.id, `Sales Return ${returnNumber} (${return_type})`
      ]);

      // If Same Defective Exchange and no explicit exchange_items passed, deduct 1-for-1 replacement batch
      if (isDefect && (return_type === 'Same Defective Exchange' || return_type === 'Same Product Exchange (Defective)') && (!Array.isArray(exchange_items) || exchange_items.length === 0)) {
        const replacementBatch = queryOne("SELECT id, current_qty FROM product_batches WHERE product_id = ? AND store_id = ? AND current_qty >= ? ORDER BY expiry_date ASC", [origItem.product_id, storeId, retQty])
          || queryOne("SELECT id, current_qty FROM product_batches WHERE product_id = ? AND store_id = ? AND current_qty > 0 ORDER BY expiry_date ASC", [origItem.product_id, storeId]);

        if (replacementBatch) {
          const newQty = Math.max(0, replacementBatch.current_qty - retQty);
          execute("UPDATE product_batches SET current_qty = ? WHERE id = ?", [newQty, replacementBatch.id]);

          execute(`
            INSERT INTO inventory_transactions (
              id, store_id, product_id, batch_id, movement_type, reference_type, reference_id,
              quantity, unit, user_id, notes
            ) VALUES (?, ?, ?, ?, 'SalesExchangeOut', 'SalesReturn', ?, ?, ?, ?, ?)
          `, [
            `itx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, storeId, origItem.product_id, replacementBatch.id, returnId,
            retQty, origItem.unit, req.user!.id, `Defective Replacement Unit Out for Return ${returnNumber}`
          ]);
        }
      }
    }

    // 2. Process Exchange Items if applicable
    if ((return_type === 'Sale Exchange' || return_type === 'Same Product Exchange (Defective)' || return_type === 'Same Defective Exchange') && Array.isArray(exchange_items) && exchange_items.length > 0) {
      for (const ex of exchange_items) {
        const exQty = Number(ex.quantity) || 0;
        if (exQty <= 0) continue;
        const exRate = Number(ex.rate) || 0;
        exchangeTotal += (exQty * exRate);

        // Deduct batch stock for exchange item
        if (ex.batch_id) {
          const b = queryOne("SELECT current_qty FROM product_batches WHERE id = ?", [ex.batch_id]);
          const newQty = Math.max(0, (b ? b.current_qty : 0) - exQty);
          execute("UPDATE product_batches SET current_qty = ? WHERE id = ?", [newQty, ex.batch_id]);
        } else {
          const activeBatch = queryOne("SELECT id, current_qty FROM product_batches WHERE product_id = ? AND store_id = ? AND current_qty > 0 ORDER BY expiry_date ASC", [ex.product_id, storeId]);
          if (activeBatch) {
            const newQty = Math.max(0, activeBatch.current_qty - exQty);
            execute("UPDATE product_batches SET current_qty = ? WHERE id = ?", [newQty, activeBatch.id]);
          }
        }

        execute(`
          INSERT INTO inventory_transactions (
            id, store_id, product_id, batch_id, movement_type, reference_type, reference_id,
            quantity, unit, user_id, notes
          ) VALUES (?, ?, ?, ?, 'SalesExchangeOut', 'SalesReturn', ?, ?, ?, ?, ?)
        `, [
          `itx-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`, storeId, ex.product_id, ex.batch_id || null, returnId,
          exQty, ex.unit || 'Pcs', req.user!.id, `Sales Exchange Replacement Out for Return ${returnNumber}`
        ]);
      }
    }

    // 3. Determine Refund Amount
    if (return_type === 'Full Refund') {
      actualRefund = grandTotal;
    } else if (return_type === 'Partial Refund') {
      actualRefund = Math.min(grandTotal, Number(refund_amount) || grandTotal);
    } else if (return_type === 'Sale Exchange') {
      actualRefund = Math.max(0, grandTotal - exchangeTotal);
    } else if (return_type === 'Credit Note') {
      actualRefund = 0; // Recorded as store credit / udhaar reduction
    } else if (return_type === 'Same Defective Exchange' || return_type === 'Same Product Exchange (Defective)') {
      actualRefund = 0; // 1-to-1 replacement
    }

    // 4. Save Sales Return Header
    const finalReason = `${reason || 'Customer Return'}${is_defective ? ' [Defective/Damaged Item]' : ''}`;
    const returnDate = new Date().toISOString().split('T')[0];
    execute(`
      INSERT INTO sales_returns (
        id, return_number, credit_note_number, sales_id, customer_id, store_id, return_date, return_type, reason,
        taxable_value, total_tax, grand_total, refund_amount, status, credit_note_status, used_amount, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      returnId, returnNumber, return_type === 'Credit Note' ? creditNoteNumber : null, sales_id, targetCustomerId || null, storeId, returnDate, return_type || 'Partial Refund', finalReason,
      totalTaxable, totalTax, grandTotal, actualRefund, return_type === 'Credit Note' ? 'Active' : 'Completed', return_type === 'Credit Note' ? 'Active' : 'Completed', 0, req.user!.username
    ]);

    // 5. Update Customer Ledger & Udhaar Balance for Credit Note or Customer Return
    let updatedOutstanding = 0;
    if (targetCustomerId) {
      const customer = queryOne("SELECT * FROM customers WHERE id = ?", [targetCustomerId]);
      if (customer) {
        if (return_type === 'Credit Note') {
          // Reduce outstanding / record credit note against customer udhaar
          updatedOutstanding = Math.max(0, customer.current_outstanding - grandTotal);
          execute("UPDATE customers SET current_outstanding = ? WHERE id = ?", [updatedOutstanding, customer.id]);

          execute(`
            INSERT INTO customer_transactions (
              id, customer_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by
            ) VALUES (?, ?, ?, DATE('now'), ?, ?, 0, ?, ?, ?)
          `, [
            `ctx-${Date.now()}`, customer.id, storeId, creditNoteNumber,
            `Credit Note Issued - Return for Invoice ${invoice.invoice_number}`, grandTotal, updatedOutstanding, req.user!.username
          ]);
        } else if (return_type === 'Full Refund' || return_type === 'Partial Refund') {
          // Log credit in customer ledger if customer is tracked
          if (actualRefund > 0) {
            updatedOutstanding = Math.max(0, customer.current_outstanding - actualRefund);
            execute("UPDATE customers SET current_outstanding = ? WHERE id = ?", [updatedOutstanding, customer.id]);

            execute(`
              INSERT INTO customer_transactions (
                id, customer_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by
              ) VALUES (?, ?, ?, DATE('now'), ?, ?, 0, ?, ?, ?)
            `, [
              `ctx-${Date.now()}`, customer.id, storeId, returnNumber,
              `Sales Return Refund (${return_type}) - Invoice ${invoice.invoice_number}`, actualRefund, updatedOutstanding, req.user!.username
            ]);
          }
        }
      }
    }
  });

  logAudit(req.user!.id, req.user!.username, storeId, 'PROCESS_SALES_RETURN', 'SalesReturn', returnId, null, { returnNumber, grandTotal, return_type });
  res.status(201).json({
    message: 'Sales return processed successfully.',
    returnNumber,
    creditNoteNumber: return_type === 'Credit Note' ? creditNoteNumber : null,
    refundAmount: actualRefund,
    grandTotal
  });
});

// Get sales returns history with filters
router.get('/returns/list', (req: AuthRequest, res: Response) => {
  const { store_id, start_date, end_date, category_id, search, customer_id } = req.query;
  const storeId = (store_id as string) || req.user!.storeId || 'store-main';

  let sql = `
    SELECT DISTINCT sr.*, s.invoice_number, s.invoice_date as orig_invoice_date, s.payment_mode as orig_payment_mode,
           s.grand_total as orig_grand_total, s.created_by as orig_cashier,
           c.name as customer_name, c.mobile as customer_mobile
    FROM sales_returns sr
    JOIN sales_invoices s ON sr.sales_id = s.id
    LEFT JOIN customers c ON sr.customer_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];

  if (store_id !== 'all') {
    sql += " AND sr.store_id = ?";
    params.push(storeId);
  }

  if (start_date) {
    sql += " AND sr.return_date >= ?";
    params.push(start_date);
  }
  if (end_date) {
    sql += " AND sr.return_date <= ?";
    params.push(end_date);
  }
  if (customer_id) {
    sql += " AND sr.customer_id = ?";
    params.push(customer_id);
  }
  if (category_id && typeof category_id === 'string' && category_id.trim() !== '') {
    sql += ` AND EXISTS (
      SELECT 1 FROM sales_return_items sri
      JOIN products p ON sri.product_id = p.id
      JOIN categories cat ON p.category_id = cat.id
      WHERE sri.return_id = sr.id AND (p.category_id = ? OR cat.parent_id = ?)
    )`;
    params.push(category_id.trim(), category_id.trim());
  }
  if (search && typeof search === 'string' && search.trim() !== '') {
    const term = `%${search.trim()}%`;
    sql += " AND (sr.return_number LIKE ? OR s.invoice_number LIKE ? OR c.name LIKE ? OR c.mobile LIKE ? OR sr.credit_note_number LIKE ? OR sr.reason LIKE ?)";
    params.push(term, term, term, term, term, term);
  }

  sql += " ORDER BY sr.created_at DESC";
  const returns = queryAll(sql, params);
  res.json({ returns });
});

// Get single sales return details
router.get('/returns/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const returnRecord = queryOne(`
    SELECT sr.*, s.invoice_number, s.invoice_date as orig_invoice_date, s.payment_mode as orig_payment_mode,
           s.grand_total as orig_grand_total, s.created_by as orig_cashier, s.created_at as orig_created_at,
           s.taxable_value as orig_taxable_amount, s.total_tax as orig_total_tax, s.total_discount as orig_total_discount,
           c.name as customer_name, c.mobile as customer_mobile, c.village as customer_village, c.current_outstanding as customer_balance
    FROM sales_returns sr
    JOIN sales_invoices s ON sr.sales_id = s.id
    LEFT JOIN customers c ON sr.customer_id = c.id
    WHERE sr.id = ?
  `, [id]);

  if (!returnRecord) return res.status(404).json({ error: 'Sales return record not found.' });

  const items = queryAll(`
    SELECT sri.*,
           p.name as product_name, p.sku, p.code as product_code, p.crop, p.composition as technical_name, p.pack_size, p.product_type,
           p.hsn_code, p.gst_rate,
           b.name as brand_name, cat.name as category_name,
           pb.batch_number, pb.expiry_date, pb.mfg_date, pb.mrp as batch_mrp,
           pbc.barcode as barcode,
           si.quantity as original_billed_qty, si.rate as original_billed_rate, si.discount as original_item_discount, si.hsn_code as billed_hsn_code,
           si.taxable_value as original_taxable_value, si.total_amount as original_total_amount,
           s.invoice_number, s.invoice_date
    FROM sales_return_items sri
    JOIN products p ON sri.product_id = p.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    LEFT JOIN product_batches pb ON sri.batch_id = pb.id
    LEFT JOIN product_barcodes pbc ON p.id = pbc.product_id AND pbc.is_primary = 1
    LEFT JOIN sales_items si ON sri.sales_item_id = si.id
    LEFT JOIN sales_invoices s ON si.sales_id = s.id
    WHERE sri.return_id = ?
  `, [id]);

  res.json({ returnRecord, items });
});

// Get single sales invoice details
router.get('/:id', (req: AuthRequest, res: Response) => {
  const { id } = req.params;

  const sales = queryOne(`
    SELECT s.*, st.name as store_name, st.address as store_address, st.gstin as store_gstin, st.phone as store_phone
    FROM sales_invoices s
    JOIN stores st ON s.store_id = st.id
    WHERE s.id = ?
  `, [id]);

  if (!sales) return res.status(404).json({ error: 'Sales invoice not found.' });

  const items = queryAll(`
    SELECT si.*,
           p.sku, p.code as product_code, p.crop, p.composition as technical_name, p.pack_size, p.product_type,
           b.name as brand_name, cat.name as category_name,
           pb.batch_number, pb.expiry_date, pb.mfg_date, pb.mrp as batch_mrp,
           pbc.barcode as barcode
    FROM sales_items si
    LEFT JOIN products p ON si.product_id = p.id
    LEFT JOIN brands b ON p.brand_id = b.id
    LEFT JOIN categories cat ON p.category_id = cat.id
    LEFT JOIN product_batches pb ON si.batch_id = pb.id
    LEFT JOIN product_barcodes pbc ON p.id = pbc.product_id AND pbc.is_primary = 1
    WHERE si.sales_id = ?
  `, [id]);
  const company = queryOne("SELECT * FROM company_settings WHERE id = 1");

  res.json({ sales, items, company });
});

// Cancel / Reverse Sales Invoice (Never physically delete!)
router.post('/:id/cancel', requirePermission('sales:cancel'), (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const { reason } = req.body;

  if (!reason) return res.status(400).json({ error: 'A cancellation reason is required.' });

  const invoice = queryOne("SELECT * FROM sales_invoices WHERE id = ?", [id]);
  if (!invoice) return res.status(404).json({ error: 'Sales invoice not found.' });

  if (invoice.status === 'Cancelled') {
    return res.status(400).json({ error: 'Invoice is already cancelled.' });
  }

  const items = queryAll("SELECT * FROM sales_items WHERE sales_id = ?", [id]);

  transaction(() => {
    // 1. Mark invoice as Cancelled
    execute(`
      UPDATE sales_invoices
      SET status = 'Cancelled', cancelled_at = CURRENT_TIMESTAMP, cancel_reason = ?
      WHERE id = ?
    `, [reason, id]);

    // 2. Restock batches & log inventory transactions
    for (const item of items) {
      if (item.batch_id) {
        execute("UPDATE product_batches SET current_qty = current_qty + ? WHERE id = ?", [item.quantity, item.batch_id]);
      }

      execute(`
        INSERT INTO inventory_transactions (
          id, store_id, product_id, batch_id, movement_type, reference_type, reference_id,
          quantity, unit, user_id, notes
        ) VALUES (?, ?, ?, ?, 'SalesCancel', 'SalesInvoice', ?, ?, ?, ?, ?)
      `, [
        `itx-${Date.now()}-${Math.random()}`, invoice.store_id, item.product_id, item.batch_id, id,
        item.quantity, item.unit, req.user!.id, `Reversal of Cancelled Invoice ${invoice.invoice_number}`
      ]);
    }

    // 3. Reverse Customer Ledger & Outstanding if tracked customer
    if (invoice.customer_id) {
      const customer = queryOne("SELECT * FROM customers WHERE id = ?", [invoice.customer_id]);
      if (customer) {
        const newOutstanding = Math.max(0, customer.current_outstanding - invoice.balance_due);
        execute("UPDATE customers SET current_outstanding = ? WHERE id = ?", [newOutstanding, customer.id]);

        execute(`
          INSERT INTO customer_transactions (
            id, customer_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by
          ) VALUES (?, ?, ?, DATE('now'), ?, ?, 0, ?, ?, ?)
        `, [
          `ctx-${Date.now()}`, customer.id, invoice.store_id, invoice.invoice_number,
          `Cancelled Invoice Reversal - ${reason}`, invoice.grand_total, newOutstanding, req.user!.username
        ]);
      }
    }

    // 4. Update Cash Register if cash sale
    if ((invoice.payment_mode || '').toLowerCase() === 'cash' && invoice.amount_received > 0) {
      execute(`
        UPDATE cash_registers
        SET cash_sales = Math.max(0, cash_sales - ?),
            expected_closing_cash = Math.max(0, expected_closing_cash - ?)
        WHERE store_id = ? AND status = 'Open'
      `, [invoice.amount_received, invoice.amount_received, invoice.store_id]);
    }
  });

  logAudit(req.user!.id, req.user!.username, invoice.store_id, 'CANCEL_SALES_INVOICE', 'SalesInvoice', id, invoice, { reason });
  res.json({ message: 'Sales invoice cancelled and inventory reversed successfully.' });
});

// Permanent deletion of sales invoice with full data cleanup and inventory restocking
const deleteSalesInvoiceHandler = (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const invoice = queryOne("SELECT * FROM sales_invoices WHERE id = ?", [id]);
  if (!invoice) return res.status(404).json({ error: 'Sales invoice not found.' });

  transaction(() => {
    // 1. Restock batch quantities (if invoice was not already cancelled)
    if (invoice.status !== 'Cancelled') {
      const items = queryAll("SELECT * FROM sales_items WHERE sales_id = ?", [id]);
      for (const item of items) {
        if (item.batch_id) {
          execute("UPDATE product_batches SET current_qty = current_qty + ? WHERE id = ?", [item.quantity, item.batch_id]);
        }
      }

      // Revert customer outstanding balance if credit/udhaar sale
      if (invoice.customer_id && invoice.balance_due > 0) {
        const customer = queryOne("SELECT * FROM customers WHERE id = ?", [invoice.customer_id]);
        if (customer) {
          const newOutstanding = Math.max(0, customer.current_outstanding - invoice.balance_due);
          execute("UPDATE customers SET current_outstanding = ? WHERE id = ?", [newOutstanding, customer.id]);
        }
      }

      // Adjust cash register if cash sale
      if ((invoice.payment_mode || '').toLowerCase() === 'cash' && invoice.amount_received > 0) {
        execute(`
          UPDATE cash_registers
          SET cash_sales = Math.max(0, cash_sales - ?),
              expected_closing_cash = Math.max(0, expected_closing_cash - ?)
          WHERE store_id = ? AND status = 'Open'
        `, [invoice.amount_received, invoice.amount_received, invoice.store_id]);
      }
    }

    // 2. Clean up customer ledger entries and payments
    execute("DELETE FROM customer_transactions WHERE reference_no = ?", [invoice.invoice_number]);
    execute("DELETE FROM payments WHERE entity_type = 'Customer' AND reference_number = ?", [invoice.invoice_number]);
    execute("DELETE FROM inventory_transactions WHERE reference_id = ?", [id]);

    // 3. Delete sale items and invoice
    execute("DELETE FROM sales_items WHERE sales_id = ?", [id]);
    execute("DELETE FROM sales_invoices WHERE id = ?", [id]);
  });

  logAudit(req.user!.id, req.user!.username, invoice.store_id, 'DELETE_SALES_INVOICE', 'SalesInvoice', id, invoice, null);
  res.json({ message: `Sales invoice #${invoice.invoice_number} deleted, inventory stock restored, and customer balance corrected.` });
};

router.delete('/invoices/:id', requirePermission('sales:cancel'), deleteSalesInvoiceHandler);
router.delete('/:id', requirePermission('sales:cancel'), deleteSalesInvoiceHandler);

export default router;
