import { getDb } from './database';

export async function initializeSchema() {
  const db = await getDb();

  const schemaSql = `
    -- Enable FK
    PRAGMA foreign_keys = ON;

    -- Roles
    CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      description TEXT,
      is_system INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Permissions
    CREATE TABLE IF NOT EXISTS permissions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT
    );

    -- Role Permissions
    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id TEXT NOT NULL,
      permission_code TEXT NOT NULL,
      PRIMARY KEY (role_id, permission_code),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    );

    -- User Permission Overrides
    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id TEXT NOT NULL,
      permission_code TEXT NOT NULL,
      is_granted INTEGER DEFAULT 1,
      PRIMARY KEY (user_id, permission_code)
    );

    -- Stores / Branches
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      address TEXT,
      city TEXT,
      state TEXT NOT NULL DEFAULT 'Karnataka',
      pin TEXT,
      phone TEXT,
      email TEXT,
      gstin TEXT,
      manager_id TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Users
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      email TEXT UNIQUE,
      mobile TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role_id TEXT NOT NULL,
      store_id TEXT,
      is_active INTEGER DEFAULT 1,
      last_login TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Company Settings
    CREATE TABLE IF NOT EXISTS company_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      business_name TEXT NOT NULL,
      legal_name TEXT,
      logo_url TEXT,
      address TEXT,
      phone TEXT,
      email TEXT,
      pan TEXT,
      gstin TEXT,
      state TEXT DEFAULT 'Karnataka',
      state_code TEXT DEFAULT '29',
      financial_year TEXT DEFAULT '2026-2027',
      currency TEXT DEFAULT '₹',
      invoice_prefix TEXT DEFAULT 'INV-',
      po_prefix TEXT DEFAULT 'PO-',
      pr_prefix TEXT DEFAULT 'PR-',
      so_prefix TEXT DEFAULT 'SR-',
      terms_and_conditions TEXT,
      bank_details TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      parent_id TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    );

    -- Brands
    CREATE TABLE IF NOT EXISTS brands (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      code TEXT NOT NULL UNIQUE,
      manufacturer TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Units
    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      symbol TEXT NOT NULL UNIQUE,
      is_base INTEGER DEFAULT 0
    );

    -- Unit Conversions
    CREATE TABLE IF NOT EXISTS unit_conversions (
      id TEXT PRIMARY KEY,
      from_unit TEXT NOT NULL,
      to_unit TEXT NOT NULL,
      multiplier REAL NOT NULL,
      UNIQUE (from_unit, to_unit)
    );

    -- HSN Codes
    CREATE TABLE IF NOT EXISTS hsn_codes (
      hsn_code TEXT PRIMARY KEY,
      description TEXT,
      gst_rate REAL NOT NULL DEFAULT 18,
      cgst_rate REAL NOT NULL DEFAULT 9,
      sgst_rate REAL NOT NULL DEFAULT 9,
      igst_rate REAL NOT NULL DEFAULT 18,
      cess_rate REAL DEFAULT 0
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      sku TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      short_name TEXT,
      description TEXT,
      category_id TEXT NOT NULL,
      subcategory_id TEXT,
      brand_id TEXT,
      manufacturer TEXT,
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      product_type TEXT DEFAULT 'Seed',
      crop TEXT,
      suitable_crops TEXT,
      application TEXT,
      composition TEXT,
      formulation TEXT,
      pack_size TEXT,
      unit TEXT NOT NULL DEFAULT 'Kg',
      storage_instructions TEXT,
      usage_instructions TEXT,
      license_no TEXT,
      purchase_price REAL DEFAULT 0,
      avg_purchase_price REAL DEFAULT 0,
      mrp REAL DEFAULT 0,
      selling_price REAL DEFAULT 0,
      wholesale_price REAL DEFAULT 0,
      dealer_price REAL DEFAULT 0,
      min_selling_price REAL DEFAULT 0,
      discount_pct REAL DEFAULT 0,
      hsn_code TEXT NOT NULL DEFAULT '1209',
      gst_rate REAL DEFAULT 18,
      cgst REAL DEFAULT 9,
      sgst REAL DEFAULT 9,
      igst REAL DEFAULT 18,
      cess REAL DEFAULT 0,
      min_stock REAL DEFAULT 10,
      reorder_level REAL DEFAULT 15,
      reorder_qty REAL DEFAULT 50,
      max_stock REAL DEFAULT 500,
      opening_stock REAL DEFAULT 0,
      requires_batch INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    -- Barcodes
    CREATE TABLE IF NOT EXISTS product_barcodes (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      barcode TEXT NOT NULL UNIQUE,
      is_primary INTEGER DEFAULT 1,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    -- Batches
    CREATE TABLE IF NOT EXISTS product_batches (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      batch_number TEXT NOT NULL,
      store_id TEXT NOT NULL,
      mfg_date TEXT,
      expiry_date TEXT NOT NULL,
      supplier_id TEXT,
      purchase_invoice_no TEXT,
      purchase_price REAL NOT NULL,
      mrp REAL NOT NULL,
      initial_qty REAL NOT NULL,
      current_qty REAL NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      customer_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      mobile TEXT,
      email TEXT,
      address TEXT,
      village TEXT,
      taluk TEXT,
      district TEXT,
      state TEXT DEFAULT 'Karnataka',
      pin TEXT,
      gstin TEXT,
      pan TEXT,
      customer_type TEXT DEFAULT 'Retail',
      credit_limit REAL DEFAULT 10000,
      current_outstanding REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      farm_village TEXT,
      crop TEXT,
      land_area_acres REAL DEFAULT 0,
      preferred_products TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Customer Ledger
    CREATE TABLE IF NOT EXISTS customer_transactions (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      transaction_date TEXT NOT NULL,
      reference_no TEXT NOT NULL,
      description TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

    -- Suppliers
    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      supplier_code TEXT NOT NULL UNIQUE,
      company_name TEXT NOT NULL,
      contact_person TEXT,
      mobile TEXT,
      email TEXT,
      address TEXT,
      city TEXT,
      state TEXT DEFAULT 'Karnataka',
      pin TEXT,
      gstin TEXT,
      pan TEXT,
      payment_terms TEXT DEFAULT '30 Days',
      credit_limit REAL DEFAULT 500000,
      current_outstanding REAL DEFAULT 0,
      opening_balance REAL DEFAULT 0,
      bank_details TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Supplier Ledger
    CREATE TABLE IF NOT EXISTS supplier_transactions (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      transaction_date TEXT NOT NULL,
      reference_no TEXT NOT NULL,
      description TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    );

    -- Purchase Orders
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id TEXT PRIMARY KEY,
      po_number TEXT NOT NULL UNIQUE,
      store_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      po_date TEXT NOT NULL,
      expected_delivery TEXT,
      status TEXT DEFAULT 'Draft',
      total_amount REAL DEFAULT 0,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Purchase Order Items
    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id TEXT PRIMARY KEY,
      po_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      rate REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total REAL NOT NULL,
      FOREIGN KEY (po_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Purchase Invoices
    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      supplier_invoice_no TEXT NOT NULL,
      store_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      status TEXT DEFAULT 'Posted',
      taxable_value REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      cess REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      cash_discount REAL DEFAULT 0,
      supplier_credit_note_status TEXT DEFAULT 'none',
      supplier_credit_note_no TEXT,
      supplier_credit_note_date TEXT,
      supplier_credit_note_amount REAL DEFAULT 0,
      supplier_notes TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Purchase Items
    CREATE TABLE IF NOT EXISTS purchase_items (
      id TEXT PRIMARY KEY,
      purchase_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_id TEXT,
      batch_number TEXT,
      mfg_date TEXT,
      expiry_date TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      purchase_rate REAL NOT NULL,
      selling_price REAL DEFAULT 0,
      mrp REAL NOT NULL,
      discount REAL DEFAULT 0,
      discount_pct REAL DEFAULT 0,
      hsn_code TEXT NOT NULL DEFAULT '1209',
      taxable_value REAL NOT NULL,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      cess REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      FOREIGN KEY (purchase_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Purchase Returns
    CREATE TABLE IF NOT EXISTS purchase_returns (
      id TEXT PRIMARY KEY,
      return_number TEXT NOT NULL UNIQUE,
      purchase_id TEXT NOT NULL,
      supplier_id TEXT NOT NULL,
      store_id TEXT NOT NULL,
      return_date TEXT NOT NULL,
      reason TEXT,
      taxable_value REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      status TEXT DEFAULT 'Posted',
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (purchase_id) REFERENCES purchase_invoices(id),
      FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Purchase Return Items
    CREATE TABLE IF NOT EXISTS purchase_return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_id TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      rate REAL NOT NULL,
      total_amount REAL NOT NULL,
      FOREIGN KEY (return_id) REFERENCES purchase_returns(id) ON DELETE CASCADE
    );

    -- Sales Invoices
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id TEXT PRIMARY KEY,
      invoice_number TEXT NOT NULL UNIQUE,
      store_id TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT DEFAULT 'Walk-in Customer',
      customer_gstin TEXT,
      customer_mobile TEXT,
      invoice_date TEXT NOT NULL,
      invoice_type TEXT DEFAULT 'B2C',
      status TEXT DEFAULT 'Completed',
      payment_status TEXT DEFAULT 'Paid',
      taxable_value REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      cess REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      total_discount REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      amount_received REAL DEFAULT 0,
      balance_due REAL DEFAULT 0,
      payment_mode TEXT DEFAULT 'Cash',
      credit_note_id TEXT,
      credit_note_amount REAL DEFAULT 0,
      notes TEXT,
      due_date TEXT,
      is_credit_sale INTEGER DEFAULT 0,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      cancelled_at TEXT,
      cancel_reason TEXT,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Sales Items
    CREATE TABLE IF NOT EXISTS sales_items (
      id TEXT PRIMARY KEY,
      sales_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_id TEXT,
      product_name TEXT NOT NULL,
      hsn_code TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      rate REAL NOT NULL,
      discount REAL DEFAULT 0,
      taxable_value REAL NOT NULL,
      cgst_rate REAL DEFAULT 0,
      cgst_amount REAL DEFAULT 0,
      sgst_rate REAL DEFAULT 0,
      sgst_amount REAL DEFAULT 0,
      igst_rate REAL DEFAULT 0,
      igst_amount REAL DEFAULT 0,
      cess REAL DEFAULT 0,
      total_amount REAL NOT NULL,
      cost_price REAL DEFAULT 0,
      FOREIGN KEY (sales_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Held Bills for POS
    CREATE TABLE IF NOT EXISTS held_bills (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT,
      items_json TEXT NOT NULL,
      notes TEXT,
      held_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Sales Returns
    CREATE TABLE IF NOT EXISTS sales_returns (
      id TEXT PRIMARY KEY,
      return_number TEXT NOT NULL UNIQUE,
      sales_id TEXT NOT NULL,
      customer_id TEXT,
      store_id TEXT NOT NULL,
      return_date TEXT NOT NULL,
      return_type TEXT DEFAULT 'Full',
      reason TEXT,
      taxable_value REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      grand_total REAL DEFAULT 0,
      refund_amount REAL DEFAULT 0,
      status TEXT DEFAULT 'Completed',
      credit_note_number TEXT,
      credit_note_status TEXT DEFAULT 'Active',
      used_amount REAL DEFAULT 0,
      redeemed_in_sales_id TEXT,
      redeemed_at TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sales_id) REFERENCES sales_invoices(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Sales Return Items
    CREATE TABLE IF NOT EXISTS sales_return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      sales_item_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_id TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      rate REAL NOT NULL,
      total_amount REAL NOT NULL,
      FOREIGN KEY (return_id) REFERENCES sales_returns(id) ON DELETE CASCADE
    );

    -- Payments
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      payment_number TEXT NOT NULL UNIQUE,
      store_id TEXT NOT NULL,
      entity_type TEXT NOT NULL, -- 'Customer' or 'Supplier'
      entity_id TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL DEFAULT 'Cash',
      reference_number TEXT,
      remarks TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Inventory Transactions
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_id TEXT,
      movement_type TEXT NOT NULL, -- 'Opening', 'Purchase', 'PurchaseReturn', 'Sale', 'SalesReturn', 'Adjustment', 'TransferIn', 'TransferOut', 'Expiry', 'Damage'
      reference_type TEXT,
      reference_id TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      previous_qty REAL DEFAULT 0,
      new_qty REAL DEFAULT 0,
      user_id TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Stock Adjustments
    CREATE TABLE IF NOT EXISTS stock_adjustments (
      id TEXT PRIMARY KEY,
      adjustment_number TEXT NOT NULL UNIQUE,
      store_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_id TEXT,
      system_qty REAL NOT NULL,
      physical_qty REAL NOT NULL,
      difference REAL NOT NULL,
      reason TEXT NOT NULL,
      remarks TEXT,
      status TEXT DEFAULT 'Approved',
      approved_by TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id),
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Stock Transfers
    CREATE TABLE IF NOT EXISTS stock_transfers (
      id TEXT PRIMARY KEY,
      transfer_number TEXT NOT NULL UNIQUE,
      from_store_id TEXT NOT NULL,
      to_store_id TEXT NOT NULL,
      status TEXT DEFAULT 'Requested', -- 'Requested', 'Approved', 'Dispatched', 'Received', 'Completed', 'Cancelled'
      notes TEXT,
      created_by TEXT,
      approved_by TEXT,
      dispatched_at TEXT,
      received_at TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (from_store_id) REFERENCES stores(id),
      FOREIGN KEY (to_store_id) REFERENCES stores(id)
    );

    -- Stock Transfer Items
    CREATE TABLE IF NOT EXISTS stock_transfer_items (
      id TEXT PRIMARY KEY,
      transfer_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      batch_id TEXT,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      FOREIGN KEY (transfer_id) REFERENCES stock_transfers(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    -- Stock Audits
    CREATE TABLE IF NOT EXISTS stock_audits (
      id TEXT PRIMARY KEY,
      audit_number TEXT NOT NULL UNIQUE,
      store_id TEXT NOT NULL,
      audit_date TEXT NOT NULL,
      status TEXT DEFAULT 'Completed',
      total_items INTEGER DEFAULT 0,
      total_discrepancy_value REAL DEFAULT 0,
      notes TEXT,
      conducted_by TEXT,
      approved_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      expense_number TEXT NOT NULL UNIQUE,
      store_id TEXT NOT NULL,
      category TEXT NOT NULL,
      vendor_name TEXT,
      description TEXT,
      amount REAL NOT NULL,
      payment_mode TEXT DEFAULT 'Cash',
      expense_date TEXT NOT NULL,
      attachment_url TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Cash Registers
    CREATE TABLE IF NOT EXISTS cash_registers (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      register_date TEXT NOT NULL,
      opening_cash REAL DEFAULT 0,
      cash_sales REAL DEFAULT 0,
      customer_cash_payments REAL DEFAULT 0,
      cash_purchases REAL DEFAULT 0,
      cash_expenses REAL DEFAULT 0,
      supplier_cash_payments REAL DEFAULT 0,
      cash_deposits REAL DEFAULT 0,
      cash_withdrawals REAL DEFAULT 0,
      expected_closing_cash REAL DEFAULT 0,
      actual_closing_cash REAL DEFAULT 0,
      difference REAL DEFAULT 0,
      status TEXT DEFAULT 'Open',
      closed_at TEXT,
      closed_by TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Day Closings
    CREATE TABLE IF NOT EXISTS day_closings (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      closing_date TEXT NOT NULL UNIQUE,
      opening_cash REAL DEFAULT 0,
      total_sales REAL DEFAULT 0,
      cash_sales REAL DEFAULT 0,
      upi_sales REAL DEFAULT 0,
      card_sales REAL DEFAULT 0,
      credit_sales REAL DEFAULT 0,
      sales_returns REAL DEFAULT 0,
      expenses REAL DEFAULT 0,
      customer_collections REAL DEFAULT 0,
      supplier_payments REAL DEFAULT 0,
      expected_cash REAL DEFAULT 0,
      actual_cash REAL DEFAULT 0,
      difference REAL DEFAULT 0,
      notes TEXT,
      status TEXT DEFAULT 'Closed',
      closed_by TEXT,
      closed_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- GST Transactions
    CREATE TABLE IF NOT EXISTS gst_transactions (
      id TEXT PRIMARY KEY,
      store_id TEXT NOT NULL,
      transaction_type TEXT NOT NULL, -- 'Output' (Sales) or 'Input' (Purchases)
      reference_no TEXT NOT NULL,
      transaction_date TEXT NOT NULL,
      entity_name TEXT,
      gstin TEXT,
      state TEXT,
      is_interstate INTEGER DEFAULT 0,
      hsn_code TEXT NOT NULL,
      taxable_value REAL NOT NULL,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      cess REAL DEFAULT 0,
      total_gst REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (store_id) REFERENCES stores(id)
    );

    -- Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      username TEXT NOT NULL,
      store_id TEXT,
      action TEXT NOT NULL,
      entity TEXT NOT NULL,
      entity_id TEXT,
      previous_value TEXT,
      new_value TEXT,
      ip_address TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      store_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      level TEXT DEFAULT 'info', -- 'info', 'warning', 'error'
      target_role TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);
    CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
    CREATE INDEX IF NOT EXISTS idx_batches_expiry ON product_batches(expiry_date);
    CREATE INDEX IF NOT EXISTS idx_batches_product ON product_batches(product_id);
    CREATE INDEX IF NOT EXISTS idx_sales_date ON sales_invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchase_invoices(invoice_date);
    CREATE INDEX IF NOT EXISTS idx_inv_tx_product ON inventory_transactions(product_id);
    CREATE INDEX IF NOT EXISTS idx_cust_tx_cust ON customer_transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_supp_tx_supp ON supplier_transactions(supplier_id);
  `;

  db.exec(schemaSql);

  // Safe migrations for credit note columns on existing databases
  try { db.exec("ALTER TABLE sales_invoices ADD COLUMN credit_note_id TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE sales_invoices ADD COLUMN credit_note_amount REAL DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE sales_returns ADD COLUMN credit_note_number TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE sales_returns ADD COLUMN credit_note_status TEXT DEFAULT 'Active';"); } catch (_) {}
  try { db.exec("ALTER TABLE sales_returns ADD COLUMN used_amount REAL DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE sales_returns ADD COLUMN redeemed_in_sales_id TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE sales_returns ADD COLUMN redeemed_at TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE sales_invoices ADD COLUMN due_date TEXT;"); } catch (_) {}

  // Safe migrations for purchase invoice supplier credit notes, cash discount, HSN and selling prices
  try { db.exec("ALTER TABLE purchase_invoices ADD COLUMN cash_discount REAL DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_invoices ADD COLUMN supplier_credit_note_status TEXT DEFAULT 'none';"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_invoices ADD COLUMN supplier_credit_note_no TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_invoices ADD COLUMN supplier_credit_note_date TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_invoices ADD COLUMN supplier_credit_note_amount REAL DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_invoices ADD COLUMN supplier_notes TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_items ADD COLUMN selling_price REAL DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_items ADD COLUMN discount_pct REAL DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_items ADD COLUMN hsn_code TEXT DEFAULT '1209';"); } catch (_) {}

  // Safe migrations for purchase orders and items
  try { db.exec("ALTER TABLE purchase_orders ADD COLUMN subtotal REAL DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_orders ADD COLUMN tax_amount REAL DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_orders ADD COLUMN payment_terms TEXT;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_order_items ADD COLUMN unit TEXT DEFAULT 'Kg';"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_order_items ADD COLUMN hsn_code TEXT DEFAULT '1209';"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_order_items ADD COLUMN tax_rate REAL DEFAULT 18;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_order_items ADD COLUMN taxable_amount REAL DEFAULT 0;"); } catch (_) {}

  // Safe migrations for purchase returns
  try { db.exec("ALTER TABLE purchase_return_items ADD COLUMN hsn_code TEXT DEFAULT '1209';"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_return_items ADD COLUMN cgst REAL DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_return_items ADD COLUMN sgst REAL DEFAULT 0;"); } catch (_) {}
  try { db.exec("ALTER TABLE purchase_return_items ADD COLUMN igst REAL DEFAULT 0;"); } catch (_) {}

  // Ensure Miscellaneous category exists
  try { db.exec("INSERT OR IGNORE INTO categories (id, name, code, parent_id, description) VALUES ('cat-misc', 'Miscellaneous', 'MISC', NULL, 'General and miscellaneous agricultural products');"); } catch (_) {}

  // Safe data backfill: Ensure every single product in the catalog has a valid HSN code
  try {
    db.exec(`
      UPDATE products SET hsn_code = '1209' WHERE (hsn_code IS NULL OR trim(hsn_code) = '' OR hsn_code = '0') AND product_type = 'Seed';
      UPDATE products SET hsn_code = '3105' WHERE (hsn_code IS NULL OR trim(hsn_code) = '' OR hsn_code = '0') AND product_type = 'Fertilizer';
      UPDATE products SET hsn_code = '3808' WHERE (hsn_code IS NULL OR trim(hsn_code) = '' OR hsn_code = '0') AND product_type IN ('Insecticide', 'Fungicide', 'Herbicide', 'Pesticide');
      UPDATE products SET hsn_code = '8424' WHERE (hsn_code IS NULL OR trim(hsn_code) = '' OR hsn_code = '0') AND product_type = 'Equipment';
      UPDATE products SET hsn_code = '1209' WHERE hsn_code IS NULL OR trim(hsn_code) = '' OR hsn_code = '0';
      UPDATE sales_items SET hsn_code = COALESCE((SELECT hsn_code FROM products WHERE products.id = sales_items.product_id), '1209') WHERE (hsn_code IS NULL OR trim(hsn_code) = '' OR hsn_code = '0');
    `);
  } catch (_) {}

  console.log("Database schema initialized successfully.");
}
