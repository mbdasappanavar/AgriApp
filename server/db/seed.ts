import bcrypt from 'bcryptjs';
import { getDb, queryOne, execute, transaction } from './database';

export async function seedDatabase() {
  const db = await getDb();

  console.log("Ensuring core roles, stores, and default accounts exist...");

  const salt = bcrypt.genSaltSync(10);

  transaction(() => {
    // 1. Roles
    const roles = [
      { id: 'role-superadmin', name: 'Super Admin', code: 'SUPER_ADMIN', description: 'Full system access', is_system: 1 },
      { id: 'role-manager', name: 'Store Manager', code: 'STORE_MANAGER', description: 'Store operations & reports', is_system: 1 },
      { id: 'role-sales', name: 'Sales Staff', code: 'SALES_STAFF', description: 'POS & customer billing', is_system: 1 },
      { id: 'role-inventory', name: 'Inventory Manager', code: 'INVENTORY_MANAGER', description: 'Stock, batches, purchases', is_system: 1 },
      { id: 'role-accountant', name: 'Accountant', code: 'ACCOUNTANT', description: 'GST, ledgers, finance', is_system: 1 },
      { id: 'role-auditor', name: 'Auditor', code: 'AUDITOR', description: 'Read-only access for audits', is_system: 1 },
    ];

    for (const r of roles) {
      execute(
        "INSERT OR REPLACE INTO roles (id, name, code, description, is_system) VALUES (?, ?, ?, ?, ?)",
        [r.id, r.name, r.code, r.description, r.is_system]
      );
    }

    // 2. Permissions
    const permissions = [
      // POS & Sales
      { id: 'p1', code: 'pos:access', name: 'Access POS Billing', category: 'Sales' },
      { id: 'p2', code: 'sales:view', name: 'View Sales History', category: 'Sales' },
      { id: 'p3', code: 'sales:price_override', name: 'Override Unit Price in POS', category: 'Sales' },
      { id: 'p4', code: 'sales:discount_override', name: 'Override Discount Limit in POS', category: 'Sales' },
      { id: 'p5', code: 'sales:cancel', name: 'Cancel/Reverse Sales Invoice', category: 'Sales' },
      { id: 'p6', code: 'sales:return', name: 'Process Sales Return', category: 'Sales' },
      // Inventory
      { id: 'p7', code: 'inventory:view', name: 'View Stock & Batches', category: 'Inventory' },
      { id: 'p8', code: 'inventory:adjust', name: 'Perform Stock Adjustment', category: 'Inventory' },
      { id: 'p9', code: 'inventory:transfer', name: 'Perform Inter-Store Transfer', category: 'Inventory' },
      { id: 'p10', code: 'inventory:audit', name: 'Conduct Stock Audit', category: 'Inventory' },
      // Purchases
      { id: 'p11', code: 'purchases:view', name: 'View Purchases', category: 'Purchases' },
      { id: 'p12', code: 'purchases:create', name: 'Create Purchase Invoice', category: 'Purchases' },
      { id: 'p13', code: 'purchases:return', name: 'Process Purchase Return', category: 'Purchases' },
      // Masters
      { id: 'p14', code: 'products:manage', name: 'Create/Edit Products & Categories', category: 'Masters' },
      { id: 'p15', code: 'customers:manage', name: 'Manage Customers & Credit Limits', category: 'Masters' },
      { id: 'p16', code: 'suppliers:manage', name: 'Manage Suppliers', category: 'Masters' },
      // Finance
      { id: 'p17', code: 'gst:view', name: 'View GST Reports & Summaries', category: 'Finance' },
      { id: 'p18', code: 'expenses:manage', name: 'Manage Expenses & Cash Register', category: 'Finance' },
      { id: 'p19', code: 'day_closing:execute', name: 'Execute Day Closing', category: 'Finance' },
      { id: 'p20', code: 'reports:view', name: 'View Business Analytics & Profit Reports', category: 'Reports' },
      // Admin
      { id: 'p21', code: 'users:manage', name: 'Manage Users & Permissions', category: 'Admin' },
      { id: 'p22', code: 'settings:manage', name: 'Manage Company & Store Settings', category: 'Admin' },
      { id: 'p23', code: 'audit:view', name: 'View System Audit Logs', category: 'Admin' },
      { id: 'p24', code: 'backup:manage', name: 'Manage Database Backup & Restore', category: 'Admin' },
    ];

    for (const p of permissions) {
      execute(
        "INSERT OR REPLACE INTO permissions (id, code, name, category, description) VALUES (?, ?, ?, ?, ?)",
        [p.id, p.code, p.name, p.category, p.name]
      );
    }

    // Role Permission mappings
    const allPermCodes = permissions.map(p => p.code);
    const storeManagerPerms = allPermCodes.filter(c => !c.startsWith('backup:') && !c.startsWith('users:manage'));
    const salesStaffPerms = ['pos:access', 'sales:view', 'customers:manage', 'sales:return'];
    const inventoryManagerPerms = ['inventory:view', 'inventory:adjust', 'inventory:transfer', 'inventory:audit', 'purchases:view', 'purchases:create', 'purchases:return', 'products:manage'];
    const accountantPerms = ['gst:view', 'expenses:manage', 'day_closing:execute', 'reports:view', 'sales:view', 'purchases:view'];

    for (const code of allPermCodes) {
      execute("INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)", ['role-superadmin', code]);
    }
    for (const code of storeManagerPerms) {
      execute("INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)", ['role-manager', code]);
    }
    for (const code of salesStaffPerms) {
      execute("INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)", ['role-sales', code]);
    }
    for (const code of inventoryManagerPerms) {
      execute("INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)", ['role-inventory', code]);
    }
    for (const code of accountantPerms) {
      execute("INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)", ['role-accountant', code]);
    }
    // Auditor: view-only permissions
    const auditorPerms = allPermCodes.filter(c => c.endsWith(':view'));
    for (const code of auditorPerms) {
      execute("INSERT OR IGNORE INTO role_permissions (role_id, permission_code) VALUES (?, ?)", ['role-auditor', code]);
    }

    // 3. Stores
    const stores = [
      { id: 'store-main', name: 'Shri Revanasiddeshwara Agro Center, Kalaghatagi', code: 'KLG01', address: 'Main Road, Near Bus Stand', city: 'Kalaghatagi', state: 'Karnataka', pin: '581204', phone: '+91 9844012345', email: 'sri.revanasiddeshwara@gmail.com', gstin: '29AABCA1234F1Z2' },
      { id: 'store-dharwad', name: 'Dharwad Depot Branch', code: 'DHW02', address: 'PB Road, Near Jubilee Circle', city: 'Dharwad', state: 'Karnataka', pin: '580001', phone: '+91 836 2789012', email: 'dharwad@srirevanasiddeshwara.com', gstin: '29AABCA1234F1Z2' },
      { id: 'store-belagavi', name: 'Belagavi Depot Branch', code: 'BGM03', address: 'RMC Yard, Khanapur Road', city: 'Belagavi', state: 'Karnataka', pin: '590001', phone: '+91 831 2456789', email: 'belagavi@srirevanasiddeshwara.com', gstin: '29AABCA1234F1Z2' },
    ];

    for (const s of stores) {
      execute(
        "INSERT OR REPLACE INTO stores (id, name, code, address, city, state, pin, phone, email, gstin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [s.id, s.name, s.code, s.address, s.city, s.state, s.pin, s.phone, s.email, s.gstin]
      );
    }

    // 4. Company Settings
    execute(`
      INSERT OR REPLACE INTO company_settings (
        id, business_name, legal_name, address, phone, email, pan, gstin, state, state_code,
        financial_year, currency, invoice_prefix, po_prefix, pr_prefix, terms_and_conditions, bank_details
      ) VALUES (
        1, 'Shri Revanasiddeshwara Agro Center', 'Shri Revanasiddeshwara Agro Center',
        'Main Road, Kalaghatagi, Dharwad District, Karnataka - 581204',
        '+91 9844012345', 'sri.revanasiddeshwara@gmail.com', 'AABCA1234F', '29AABCA1234F1Z2', 'Karnataka', '29',
        '2026-2027', '₹', 'INV-2627-', 'PO-2627-', 'PR-2627-',
        '1. Goods once sold will not be accepted without valid bill.\\n2. Fertilizer and seed licenses verified.\\n3. Check expiry and batch number before leaving counter.',
        'State Bank of India | Kalaghatagi Branch | A/C: 38920194821 | IFSC: SBIN0004812'
      )
    `);

    // 5. Users
    const users = [
      { id: 'usr-admin', name: 'Shri. Ramesh Annigeri', username: 'admin', email: 'admin@annapurnaagri.com', mobile: '9845012345', pwd: 'admin123', role: 'role-superadmin', store: 'store-main' },
      { id: 'usr-manager', name: 'Basavaraj Kulkarni', username: 'manager', email: 'manager@annapurnaagri.com', mobile: '9845023456', pwd: 'manager123', role: 'role-manager', store: 'store-main' },
      { id: 'usr-sales', name: 'Manjunath Pujar', username: 'sales', email: 'sales@annapurnaagri.com', mobile: '9845034567', pwd: 'sales123', role: 'role-sales', store: 'store-main' },
      { id: 'usr-inv', name: 'Pravisht Hegde', username: 'inventory', email: 'inv@annapurnaagri.com', mobile: '9845045678', pwd: 'inv123', role: 'role-inventory', store: 'store-main' },
      { id: 'usr-acc', name: 'Sujata Joshi', username: 'accountant', email: 'acc@annapurnaagri.com', mobile: '9845056789', pwd: 'acc123', role: 'role-accountant', store: 'store-main' },
      { id: 'usr-auditor', name: 'Anand Patil (CA)', username: 'auditor', email: 'auditor@annapurnaagri.com', mobile: '9845067890', pwd: 'audit123', role: 'role-auditor', store: 'store-main' },
    ];

    for (const u of users) {
      const hash = bcrypt.hashSync(u.pwd, salt);
      execute(
        "INSERT OR REPLACE INTO users (id, name, username, email, mobile, password_hash, role_id, store_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
        [u.id, u.name, u.username, u.email, u.mobile, hash, u.role, u.store]
      );
    }
  });

  // Check if operational data (products) already seeded
  const existingProd = queryOne("SELECT id FROM products LIMIT 1");
  if (existingProd) {
    console.log("Operational data already seeded.");
    return;
  }

  console.log("Seeding operational data (products, customers, suppliers)...");

  transaction(() => {
    // 6. Categories
    const categories = [
      { id: 'cat-seeds', name: 'Seeds', code: 'SEEDS', parent_id: null, desc: 'High yielding seed varieties' },
      { id: 'cat-seeds-paddy', name: 'Paddy Seeds', code: 'SEED_PADDY', parent_id: 'cat-seeds', desc: 'Hybrid and High-yield Paddy seeds' },
      { id: 'cat-seeds-maize', name: 'Maize Seeds', code: 'SEED_MAIZE', parent_id: 'cat-seeds', desc: 'Kharif & Rabi maize hybrids' },
      { id: 'cat-seeds-cotton', name: 'Cotton Seeds', code: 'SEED_COTTON', parent_id: 'cat-seeds', desc: 'BG-II Bt Cotton seeds' },
      { id: 'cat-seeds-veg', name: 'Vegetable Seeds', code: 'SEED_VEG', parent_id: 'cat-seeds', desc: 'Chilli, Tomato, Onion, Brinjal seeds' },
      
      { id: 'cat-fert', name: 'Fertilizers', code: 'FERT', parent_id: null, desc: 'Chemical and bio fertilizers' },
      { id: 'cat-fert-chemical', name: 'NPK & Straight Fert', code: 'FERT_CHEM', parent_id: 'cat-fert', desc: 'Urea, DAP, MOP, 19:19:19, 10:26:26' },
      { id: 'cat-fert-micro', name: 'Micronutrients', code: 'FERT_MICRO', parent_id: 'cat-fert', desc: 'Zinc, Boron, Ferrous, Sulphur' },
      { id: 'cat-fert-bio', name: 'Bio-Fertilizers & Humic', code: 'FERT_BIO', parent_id: 'cat-fert', desc: 'Mycorrhiza, Rhizobium, Humic acid' },

      { id: 'cat-pest', name: 'Crop Protection (Pesticides)', code: 'PEST', parent_id: null, desc: 'Insecticides, Fungicides, Herbicides' },
      { id: 'cat-pest-insect', name: 'Insecticides', code: 'PEST_INSECT', parent_id: 'cat-pest', desc: 'Systemic & Contact insecticides' },
      { id: 'cat-pest-fungi', name: 'Fungicides', code: 'PEST_FUNGI', parent_id: 'cat-pest', desc: 'Fungal control and plant health' },
      { id: 'cat-pest-herbi', name: 'Herbicides / Weedicides', code: 'PEST_HERBI', parent_id: 'cat-pest', desc: 'Pre & Post emergence weed control' },

      { id: 'cat-equip', name: 'Farm Equipment & Tools', code: 'EQUIP', parent_id: null, desc: 'Sprayers, pipes, pumps, tools' },
      { id: 'cat-equip-spray', name: 'Sprayers & Spares', code: 'EQUIP_SPRAY', parent_id: 'cat-equip', desc: 'Battery, Knapsack & Power sprayers' },
      { id: 'cat-equip-drip', name: 'Irrigation & Drip', code: 'EQUIP_DRIP', parent_id: 'cat-equip', desc: 'Drip laterals, sprinklers, fittings' },

      { id: 'cat-misc', name: 'Miscellaneous', code: 'MISC', parent_id: null, desc: 'General & miscellaneous agricultural products' },
    ];

    for (const c of categories) {
      execute(
        "INSERT OR REPLACE INTO categories (id, name, code, parent_id, description) VALUES (?, ?, ?, ?, ?)",
        [c.id, c.name, c.code, c.parent_id, c.desc]
      );
    }

    // 7. Brands
    const brands = [
      { id: 'b-syngenta', name: 'Syngenta India', code: 'SYNGENTA', mfg: 'Syngenta Ltd' },
      { id: 'b-bayer', name: 'Bayer CropScience', code: 'BAYER', mfg: 'Bayer India' },
      { id: 'b-upl', name: 'UPL Limited', code: 'UPL', mfg: 'UPL India' },
      { id: 'b-coromandel', name: 'Coromandel Gromor', code: 'GROMOR', mfg: 'Coromandel International' },
      { id: 'b-iffco', name: 'IFFCO', code: 'IFFCO', mfg: 'IFFCO Cooperative' },
      { id: 'b-rallis', name: 'Tata Rallis', code: 'RALLIS', mfg: 'Rallis India Ltd' },
      { id: 'b-mahyco', name: 'Mahyco Seeds', code: 'MAHYCO', mfg: 'Maharashtra Hybrid Seeds' },
      { id: 'b-nuziveedu', name: 'Nuziveedu Seeds', code: 'NUZIVEEDU', mfg: 'Nuziveedu Seeds Ltd' },
      { id: 'b-aspee', name: 'ASPEE Sprayers', code: 'ASPEE', mfg: 'American Spring & Pressing Works' },
      { id: 'b-jain', name: 'Jain Irrigation', code: 'JAIN', mfg: 'Jain Irrigation Systems' },
    ];

    for (const b of brands) {
      execute("INSERT OR REPLACE INTO brands (id, name, code, manufacturer) VALUES (?, ?, ?, ?)", [b.id, b.name, b.code, b.mfg]);
    }

    // 8. Units
    const units = [
      { id: 'u-kg', name: 'Kilogram', symbol: 'Kg', is_base: 1 },
      { id: 'u-g', name: 'Gram', symbol: 'g', is_base: 0 },
      { id: 'u-qtl', name: 'Quintal', symbol: 'Qtl', is_base: 0 },
      { id: 'u-l', name: 'Liter', symbol: 'L', is_base: 1 },
      { id: 'u-ml', name: 'Milliliter', symbol: 'ml', is_base: 0 },
      { id: 'u-bag', name: 'Bag (50 Kg)', symbol: 'Bag', is_base: 0 },
      { id: 'u-bottle', name: 'Bottle', symbol: 'Btl', is_base: 0 },
      { id: 'u-packet', name: 'Packet', symbol: 'Pkt', is_base: 0 },
      { id: 'u-piece', name: 'Piece', symbol: 'Pc', is_base: 1 },
      { id: 'u-box', name: 'Box', symbol: 'Box', is_base: 0 },
      { id: 'u-meter', name: 'Meter', symbol: 'm', is_base: 1 },
    ];

    for (const u of units) {
      execute("INSERT OR REPLACE INTO units (id, name, symbol, is_base) VALUES (?, ?, ?, ?)", [u.id, u.name, u.symbol, u.is_base]);
    }

    // Unit Conversions
    const conversions = [
      { id: 'uc1', from: 'Bag', to: 'Kg', mult: 50 },
      { id: 'uc2', from: 'Quintal', to: 'Kg', mult: 100 },
      { id: 'uc3', from: 'Liter', to: 'ml', mult: 1000 },
      { id: 'uc4', from: 'Kg', to: 'g', mult: 1000 },
      { id: 'uc5', from: 'Box', to: 'Pkt', mult: 10 },
      { id: 'uc6', from: 'Box', to: 'Btl', mult: 12 },
    ];

    for (const uc of conversions) {
      execute("INSERT OR REPLACE INTO unit_conversions (id, from_unit, to_unit, multiplier) VALUES (?, ?, ?, ?)", [uc.id, uc.from, uc.to, uc.mult]);
    }

    // 9. HSN Codes
    const hsnCodes = [
      { hsn: '1209', desc: 'Seeds for Sowing (Paddy, Maize, Cotton)', gst: 0, cgst: 0, sgst: 0, igst: 0 },
      { hsn: '3102', desc: 'Mineral or Chemical Nitrogenous Fertilizers (Urea)', gst: 5, cgst: 2.5, sgst: 2.5, igst: 5 },
      { hsn: '3105', desc: 'NPK Complex Fertilizers (DAP, 19:19:19, 10:26:26)', gst: 5, cgst: 2.5, sgst: 2.5, igst: 5 },
      { hsn: '3808', desc: 'Insecticides, Fungicides, Herbicides', gst: 18, cgst: 9, sgst: 9, igst: 18 },
      { hsn: '8424', desc: 'Mechanical Appliances, Battery Sprayers', gst: 12, cgst: 6, sgst: 6, igst: 12 },
      { hsn: '3917', desc: 'Tubes, Pipes & Hoses of Plastics (Drip Pipes)', gst: 18, cgst: 9, sgst: 9, igst: 18 },
    ];

    for (const h of hsnCodes) {
      execute(
        "INSERT OR REPLACE INTO hsn_codes (hsn_code, description, gst_rate, cgst_rate, sgst_rate, igst_rate) VALUES (?, ?, ?, ?, ?, ?)",
        [h.hsn, h.desc, h.gst, h.cgst, h.sgst, h.igst]
      );
    }

    // 10. Suppliers
    const suppliers = [
      { id: 'sup-coromandel', code: 'SUP001', name: 'Coromandel International Ltd', contact: 'Manoj Kumar', mobile: '9844011111', email: 'sales.hubli@coromandel.biz', address: 'Plot 12, APMC Yard', city: 'Hubballi', gstin: '29AABCC1111A1Z1', limit: 1000000 },
      { id: 'sup-iffco', code: 'SUP002', name: 'IFFCO Area Office Hubballi', contact: 'Siddheshwar Gowda', mobile: '9844022222', email: 'iffco.hubli@iffco.in', address: 'PB Road, Near Railway Station', city: 'Hubballi', gstin: '29AAATI0000I1Z2', limit: 2000000 },
      { id: 'sup-bayer', code: 'SUP003', name: 'Bayer CropScience Hubballi Depot', contact: 'Rajesh Patil', mobile: '9844033333', email: 'hubli.depot@bayer.com', address: 'Gokul Road Industrial Area', city: 'Hubballi', gstin: '29AABCB3333C1Z3', limit: 1500000 },
      { id: 'sup-syngenta', code: 'SUP004', name: 'Syngenta India Regional Depot', contact: 'Veeresh Shettar', mobile: '9844044444', email: 'syngenta.karnataka@syngenta.com', address: 'Rayapur Industrial Estate', city: 'Dharwad', gstin: '29AABCS4444S1Z4', limit: 1200000 },
      { id: 'sup-upl', code: 'SUP005', name: 'UPL Limited Depot', contact: 'Gururaj Joshi', mobile: '9844055555', email: 'upl.hubli@upl-ltd.com', address: 'Tarihal Industrial Area', city: 'Hubballi', gstin: '29AABCU5555U1Z5', limit: 800000 },
      { id: 'sup-mahyco', code: 'SUP006', name: 'Mahyco Seeds Area Distributor', contact: 'Dileep Hegde', mobile: '9844066666', email: 'mahyco.hubli@mahyco.com', address: 'Station Road', city: 'Hubballi', gstin: '29AABCM6666M1Z6', limit: 500000 },
      { id: 'sup-aspee', code: 'SUP007', name: 'ASPEE Sprayers & Equipment', contact: 'Kiran Kulkarni', mobile: '9844077777', email: 'aspee.belgaum@aspee.com', address: 'Khanapur Road', city: 'Belagavi', gstin: '29AABCA7777A1Z7', limit: 300000 },
    ];

    for (const s of suppliers) {
      execute(
        "INSERT OR REPLACE INTO suppliers (id, supplier_code, company_name, contact_person, mobile, email, address, city, state, pin, gstin, credit_limit, current_outstanding, opening_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Karnataka', '580025', ?, ?, 0, 0)",
        [s.id, s.code, s.name, s.contact, s.mobile, s.email, s.address, s.city, s.gstin, s.limit]
      );
    }

    // 11. 50+ Products
    const agriProducts = [
      // Seeds
      { name: 'Paddy Hybrid Seed - BPT 5204 (Sona Masuri)', code: 'PRD-SEED-01', sku: 'SEED-PAD-5204', type: 'Seed', crop: 'Paddy', cat: 'cat-seeds-paddy', brand: 'b-mahyco', hsn: '1209', gst: 0, pack: '10 Kg', unit: 'Pkt', buy: 650, sell: 850, mrp: 900, reqBatch: 1 },
      { name: 'Paddy Hybrid Seed - Kaveri Sampurna 244', code: 'PRD-SEED-02', sku: 'SEED-PAD-KAV', type: 'Seed', crop: 'Paddy', cat: 'cat-seeds-paddy', brand: 'b-mahyco', hsn: '1209', gst: 0, pack: '10 Kg', unit: 'Pkt', buy: 720, sell: 920, mrp: 980, reqBatch: 1 },
      { name: 'Hybrid Maize Seed - Pioneer P3396', code: 'PRD-SEED-03', sku: 'SEED-MZ-P3396', type: 'Seed', crop: 'Maize', cat: 'cat-seeds-maize', brand: 'b-syngenta', hsn: '1209', gst: 0, pack: '4 Kg', unit: 'Pkt', buy: 880, sell: 1080, mrp: 1150, reqBatch: 1 },
      { name: 'Hybrid Maize Seed - Syngenta NK6240', code: 'PRD-SEED-04', sku: 'SEED-MZ-NK6240', type: 'Seed', crop: 'Maize', cat: 'cat-seeds-maize', brand: 'b-syngenta', hsn: '1209', gst: 0, pack: '4 Kg', unit: 'Pkt', buy: 910, sell: 1120, mrp: 1200, reqBatch: 1 },
      { name: 'Bt Cotton Seed - Rassi Magic 659 BG-II', code: 'PRD-SEED-05', sku: 'SEED-COT-MAGIC', type: 'Seed', crop: 'Cotton', cat: 'cat-seeds-cotton', brand: 'b-nuziveedu', hsn: '1209', gst: 0, pack: '475 g', unit: 'Pkt', buy: 730, sell: 857, mrp: 857, reqBatch: 1 },
      { name: 'Bt Cotton Seed - Nuziveedu Bhakti BG-II', code: 'PRD-SEED-06', sku: 'SEED-COT-BHAKTI', type: 'Seed', crop: 'Cotton', cat: 'cat-seeds-cotton', brand: 'b-nuziveedu', hsn: '1209', gst: 0, pack: '475 g', unit: 'Pkt', buy: 730, sell: 857, mrp: 857, reqBatch: 1 },
      { name: 'Hybrid Chilli Seed - Syngenta Byadgi Syn-5', code: 'PRD-SEED-07', sku: 'SEED-CHILLI-SYN5', type: 'Seed', crop: 'Chilli', cat: 'cat-seeds-veg', brand: 'b-syngenta', hsn: '1209', gst: 0, pack: '10 g', unit: 'Pkt', buy: 450, sell: 580, mrp: 620, reqBatch: 1 },
      { name: 'Tomato Hybrid Seed - Abhinav (Syngenta)', code: 'PRD-SEED-08', sku: 'SEED-TOM-ABHINAV', type: 'Seed', crop: 'Tomato', cat: 'cat-seeds-veg', brand: 'b-syngenta', hsn: '1209', gst: 0, pack: '10 g', unit: 'Pkt', buy: 520, sell: 680, mrp: 720, reqBatch: 1 },

      // Fertilizers
      { name: 'Neem Coated Urea (IFFCO 45kg Bag)', code: 'PRD-FERT-01', sku: 'FERT-UREA-IFFCO', type: 'Fertilizer', crop: 'All Crops', cat: 'cat-fert-chemical', brand: 'b-iffco', hsn: '3102', gst: 5, pack: '45 Kg', unit: 'Bag', buy: 242, sell: 266, mrp: 266.50, reqBatch: 0 },
      { name: 'DAP (Di-Ammonium Phosphate 18-46-0)', code: 'PRD-FERT-02', sku: 'FERT-DAP-GROMOR', type: 'Fertilizer', crop: 'All Crops', cat: 'cat-fert-chemical', brand: 'b-coromandel', hsn: '3105', gst: 5, pack: '50 Kg', unit: 'Bag', buy: 1280, sell: 1350, mrp: 1350, reqBatch: 0 },
      { name: 'NPK Complex 19:19:19 Water Soluble', code: 'PRD-FERT-03', sku: 'FERT-WSF-191919', type: 'Fertilizer', crop: 'All Crops', cat: 'cat-fert-chemical', brand: 'b-coromandel', hsn: '3105', gst: 5, pack: '1 Kg', unit: 'Pkt', buy: 110, sell: 150, mrp: 165, reqBatch: 1 },
      { name: 'NPK Complex 10:26:26 Gromor Bag', code: 'PRD-FERT-04', sku: 'FERT-102626-GRO', type: 'Fertilizer', crop: 'All Crops', cat: 'cat-fert-chemical', brand: 'b-coromandel', hsn: '3105', gst: 5, pack: '50 Kg', unit: 'Bag', buy: 1380, sell: 1470, mrp: 1470, reqBatch: 0 },
      { name: 'MOP (Muriate of Potash 60% K2O)', code: 'PRD-FERT-05', sku: 'FERT-MOP-60', type: 'Fertilizer', crop: 'Sugarcane, Paddy', cat: 'cat-fert-chemical', brand: 'b-iffco', hsn: '3105', gst: 5, pack: '50 Kg', unit: 'Bag', buy: 1550, sell: 1700, mrp: 1700, reqBatch: 0 },
      { name: 'Zinc Sulphate Monohydrate 33% Micro', code: 'PRD-FERT-06', sku: 'FERT-ZINC-33', type: 'Fertilizer', crop: 'Paddy, Maize', cat: 'cat-fert-micro', brand: 'b-coromandel', hsn: '3105', gst: 5, pack: '5 Kg', unit: 'Pkt', buy: 320, sell: 420, mrp: 450, reqBatch: 1 },
      { name: 'Humic Acid 98% Bio Stimulant Power', code: 'PRD-FERT-07', sku: 'FERT-HUMIC-98', type: 'Fertilizer', crop: 'All Crops', cat: 'cat-fert-bio', brand: 'b-upl', hsn: '3105', gst: 5, pack: '1 Kg', unit: 'Pkt', buy: 280, sell: 390, mrp: 450, reqBatch: 1 },
      { name: 'Mycorrhiza Bio-Fertilizer VAM Powder', code: 'PRD-FERT-08', sku: 'FERT-MYCO-VAM', type: 'Fertilizer', crop: 'Cotton, Chilli', cat: 'cat-fert-bio', brand: 'b-upl', hsn: '3105', gst: 5, pack: '4 Kg', unit: 'Pkt', buy: 350, sell: 480, mrp: 520, reqBatch: 1 },

      // Pesticides - Insecticides
      { name: 'Bayer Coragen (Chlorantraniliprole 18.5% SC)', code: 'PRD-PEST-01', sku: 'PEST-CORAGEN-150ML', type: 'Insecticide', crop: 'Sugarcane, Maize, Rice', cat: 'cat-pest-insect', brand: 'b-bayer', hsn: '3808', gst: 18, pack: '150 ml', unit: 'Btl', buy: 1580, sell: 1820, mrp: 1950, reqBatch: 1 },
      { name: 'Syngenta Ampligo (Chlorantraniliprole + Lambda)', code: 'PRD-PEST-02', sku: 'PEST-AMPLIGO-100ML', type: 'Insecticide', crop: 'Cotton, Maize', cat: 'cat-pest-insect', brand: 'b-syngenta', hsn: '3808', gst: 18, pack: '100 ml', unit: 'Btl', buy: 620, sell: 740, mrp: 810, reqBatch: 1 },
      { name: 'Bayer Confidor (Imidacloprid 17.8% SL)', code: 'PRD-PEST-03', sku: 'PEST-CONFIDOR-250ML', type: 'Insecticide', crop: 'Cotton, Chilli', cat: 'cat-pest-insect', brand: 'b-bayer', hsn: '3808', gst: 18, pack: '250 ml', unit: 'Btl', buy: 420, sell: 530, mrp: 580, reqBatch: 1 },
      { name: 'Tata Rallis Anant (Thiamethoxam 25% WG)', code: 'PRD-PEST-04', sku: 'PEST-ANANT-100G', type: 'Insecticide', crop: 'Paddy, Cotton', cat: 'cat-pest-insect', brand: 'b-rallis', hsn: '3808', gst: 18, pack: '100 g', unit: 'Pkt', buy: 180, sell: 240, mrp: 270, reqBatch: 1 },
      { name: 'UPL Lancer Gold (Acephate + Imidacloprid)', code: 'PRD-PEST-05', sku: 'PEST-LANCER-500G', type: 'Insecticide', crop: 'Cotton, Paddy', cat: 'cat-pest-insect', brand: 'b-upl', hsn: '3808', gst: 18, pack: '500 g', unit: 'Pkt', buy: 480, sell: 610, mrp: 670, reqBatch: 1 },

      // Pesticides - Fungicides
      { name: 'Bayer Nativo (Tebuconazole + Trifloxystrobin)', code: 'PRD-PEST-06', sku: 'PEST-NATIVO-100G', type: 'Fungicide', crop: 'Paddy, Chilli', cat: 'cat-pest-fungi', brand: 'b-bayer', hsn: '3808', gst: 18, pack: '100 g', unit: 'Pkt', buy: 710, sell: 840, mrp: 910, reqBatch: 1 },
      { name: 'Syngenta Amistar Top (Azoxystrobin + Difenoconazole)', code: 'PRD-PEST-07', sku: 'PEST-AMISTAR-200ML', type: 'Fungicide', crop: 'Paddy, Vegetables', cat: 'cat-pest-fungi', brand: 'b-syngenta', hsn: '3808', gst: 18, pack: '200 ml', unit: 'Btl', buy: 980, sell: 1150, mrp: 1250, reqBatch: 1 },
      { name: 'UPL Saaf Fungicide (Carbendazim + Mancozeb)', code: 'PRD-PEST-08', sku: 'PEST-SAAF-500G', type: 'Fungicide', crop: 'All Crops', cat: 'cat-pest-fungi', brand: 'b-upl', hsn: '3808', gst: 18, pack: '500 g', unit: 'Pkt', buy: 290, sell: 370, mrp: 410, reqBatch: 1 },
      { name: 'Tata Contaf Plus (Hexaconazole 5% SC)', code: 'PRD-PEST-09', sku: 'PEST-CONTAF-1L', type: 'Fungicide', crop: 'Paddy, Groundnut', cat: 'cat-pest-fungi', brand: 'b-rallis', hsn: '3808', gst: 18, pack: '1 Liter', unit: 'Btl', buy: 410, sell: 520, mrp: 580, reqBatch: 1 },

      // Pesticides - Herbicides
      { name: 'Bayer Roundup (Glyphosate 41% SL Weedicide)', code: 'PRD-PEST-10', sku: 'PEST-ROUNDUP-1L', type: 'Herbicide', crop: 'Non-crop, Orchard', cat: 'cat-pest-herbi', brand: 'b-bayer', hsn: '3808', gst: 18, pack: '1 Liter', unit: 'Btl', buy: 380, sell: 470, mrp: 510, reqBatch: 1 },
      { name: 'UPL Sweeper (Imazethapyr 10% SL)', code: 'PRD-PEST-11', sku: 'PEST-SWEEPER-1L', type: 'Herbicide', crop: 'Soybean, Groundnut', cat: 'cat-pest-herbi', brand: 'b-upl', hsn: '3808', gst: 18, pack: '1 Liter', unit: 'Btl', buy: 820, sell: 990, mrp: 1080, reqBatch: 1 },
      { name: 'Syngenta Rifit (Pretilachlor 50% EC)', code: 'PRD-PEST-12', sku: 'PEST-RIFIT-1L', type: 'Herbicide', crop: 'Transplanted Paddy', cat: 'cat-pest-herbi', brand: 'b-syngenta', hsn: '3808', gst: 18, pack: '1 Liter', unit: 'Btl', buy: 420, sell: 540, mrp: 590, reqBatch: 1 },

      // Equipment & Tools
      { name: 'ASPEE 12V 12Ah Battery Knapsack Sprayer 16L', code: 'PRD-EQ-01', sku: 'EQUIP-SPRAY-BAT16L', type: 'Equipment', crop: 'All Crops', cat: 'cat-equip-spray', brand: 'b-aspee', hsn: '8424', gst: 12, pack: '1 Set', unit: 'Pc', buy: 2600, sell: 3200, mrp: 3600, reqBatch: 0 },
      { name: 'ASPEE Brass Spray Nozzle Set (3 Pcs)', code: 'PRD-EQ-02', sku: 'EQUIP-NOZZLE-SET', type: 'Equipment', crop: 'All Crops', cat: 'cat-equip-spray', brand: 'b-aspee', hsn: '8424', gst: 12, pack: '1 Set', unit: 'Pc', buy: 120, sell: 180, mrp: 220, reqBatch: 0 },
      { name: 'Jain Drip Inline Pipe 16mm 100m Roll', code: 'PRD-EQ-03', sku: 'EQUIP-DRIP-16MM', type: 'Equipment', crop: 'Chilli, Sugarcane', cat: 'cat-equip-drip', brand: 'b-jain', hsn: '3917', gst: 18, pack: '100m Roll', unit: 'Pc', buy: 1450, sell: 1850, mrp: 2100, reqBatch: 0 },
      { name: 'Agri Hand Weeder & Cultivator Tool', code: 'PRD-EQ-04', sku: 'EQUIP-WEEDER-HAND', type: 'Equipment', crop: 'All Crops', cat: 'cat-equip-drip', brand: 'b-aspee', hsn: '8424', gst: 12, pack: '1 Pc', unit: 'Pc', buy: 150, sell: 220, mrp: 250, reqBatch: 0 },
    ];

    let pCount = 1;
    for (const p of agriProducts) {
      const pid = `prod-${pCount.toString().padStart(3, '0')}`;
      execute(`
        INSERT OR REPLACE INTO products (
          id, code, sku, name, category_id, brand_id, product_type, crop, suitable_crops,
          pack_size, unit, hsn_code, gst_rate, cgst, sgst, igst,
          purchase_price, avg_purchase_price, mrp, selling_price, wholesale_price, min_selling_price,
          requires_batch, min_stock, reorder_level
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, 10, 15
        )
      `, [
        pid, p.code, p.sku, p.name, p.cat, p.brand, p.type, p.crop, p.crop,
        p.pack, p.unit, p.hsn, p.gst, p.gst/2, p.gst/2, p.gst,
        p.buy, p.buy, p.mrp, p.sell, p.sell * 0.95, p.buy * 1.05,
        p.reqBatch
      ]);

      // Barcode
      const barcodeVal = `890${(1000000000 + pCount).toString()}`;
      execute("INSERT OR REPLACE INTO product_barcodes (id, product_id, barcode, is_primary) VALUES (?, ?, ?, 1)", [`bc-${pid}`, pid, barcodeVal]);

      // Supplier mapped by brand
      const brandSupplierMap: Record<string, string> = {
        'b-mahyco': 'sup-mahyco',
        'b-syngenta': 'sup-syngenta',
        'b-nuziveedu': 'sup-mahyco',
        'b-iffco': 'sup-iffco',
        'b-coromandel': 'sup-coromandel',
        'b-upl': 'sup-upl',
        'b-bayer': 'sup-bayer',
        'b-rallis': 'sup-upl',
        'b-aspee': 'sup-aspee',
        'b-jain': 'sup-aspee'
      };
      const assignedSupplier = brandSupplierMap[p.brand] || 'sup-coromandel';

      // Varied stock levels for realistic low-stock & reorder proactive workflows
      let initialStock = 100;
      let currentStock = 75;
      if (pCount % 6 === 2) {
        currentStock = 2; // Critical low (< min_stock 10)
      } else if (pCount % 6 === 3) {
        currentStock = 0; // Out of stock
      } else if (pCount % 6 === 4) {
        currentStock = 6; // Below min_stock 10
      } else if (pCount % 6 === 5) {
        currentStock = 12; // Near reorder_level 15
      }

      // Batches for Hubballi store
      if (p.reqBatch) {
        // Valid batch
        const batch1Id = `batch-${pid}-01`;
        execute(`
          INSERT OR REPLACE INTO product_batches (
            id, product_id, batch_number, store_id, mfg_date, expiry_date,
            supplier_id, purchase_price, mrp, initial_qty, current_qty
          ) VALUES (?, ?, ?, 'store-main', '2025-10-01', '2027-09-30', ?, ?, ?, ?, ?)
        `, [batch1Id, pid, `BAT-2025-${pCount}`, assignedSupplier, p.buy, p.mrp, initialStock, currentStock]);

        // Near Expiry batch for testing alerts!
        if (pCount % 4 === 0 && currentStock > 0) {
          const batchExpId = `batch-${pid}-EXP`;
          execute(`
            INSERT OR REPLACE INTO product_batches (
              id, product_id, batch_number, store_id, mfg_date, expiry_date,
              supplier_id, purchase_price, mrp, initial_qty, current_qty
            ) VALUES (?, ?, ?, 'store-main', '2024-09-01', '2026-08-25', ?, ?, ?, 20, 4)
          `, [batchExpId, pid, `BAT-EXP-${pCount}`, assignedSupplier, p.buy, p.mrp]);
        }
      } else {
        // Non-batch products still get a standard stock record
        const nonBatchStock = (pCount % 6 === 3) ? 0 : ((pCount % 6 === 2) ? 3 : ((pCount % 6 === 4) ? 5 : 120));
        execute(`
          INSERT OR REPLACE INTO product_batches (
            id, product_id, batch_number, store_id, mfg_date, expiry_date,
            supplier_id, purchase_price, mrp, initial_qty, current_qty
          ) VALUES (?, ?, 'STD-BATCH', 'store-main', '2025-01-01', '2030-12-31', ?, ?, ?, 200, ?)
        `, [`batch-${pid}-STD`, pid, assignedSupplier, p.buy, p.mrp, nonBatchStock]);
      }

      pCount++;
    }

    // 12. 50 Customers
    const customerNames = [
      { name: 'Basavaraj Patil', village: 'Navalgund', crop: 'Cotton & Chilli', acres: 15, credit: 50000 },
      { name: 'Suresh Gowda', village: 'Shiggaon', crop: 'Paddy & Maize', acres: 22, credit: 100000 },
      { name: 'Mallappa Pujar', village: 'Kundgol', crop: 'Cotton & Groundnut', acres: 10, credit: 30000 },
      { name: 'Ramesh Annigeri', village: 'Annigeri', crop: 'Wheat & Bengalgram', acres: 18, credit: 60000 },
      { name: 'Veerabhadrappa Nargund', village: 'Nargund', crop: 'Paddy & Chilli', acres: 25, credit: 120000 },
      { name: 'Shivagangappa Kalghatgi', village: 'Kalghatgi', crop: 'Paddy & Sugarcane', acres: 12, credit: 40000 },
      { name: 'Gangadhar Shettar', village: 'Byahatti', crop: 'Chilli & Tomato', acres: 8, credit: 25000 },
      { name: 'Chennabasappa Hulkoti', village: 'Hulkoti', crop: 'Cotton & Maize', acres: 30, credit: 150000 },
      { name: 'Gudusab Makandar', village: 'Hangal', crop: 'Paddy & Arecanut', acres: 14, credit: 45000 },
      { name: 'Prabhakar Kulkarni', village: 'Hebsur', crop: 'Cotton & Onion', acres: 16, credit: 50000 },
    ];

    for (let i = 1; i <= 50; i++) {
      const template = customerNames[(i - 1) % customerNames.length];
      const cid = `cust-${i.toString().padStart(3, '0')}`;
      const name = i <= 10 ? template.name : `${template.name} (${i})`;
      const mobile = `9880${(100000 + i).toString()}`;
      
      execute(`
        INSERT OR REPLACE INTO customers (
          id, customer_code, name, mobile, village, taluk, district, state,
          customer_type, credit_limit, current_outstanding, farm_village, crop, land_area_acres
        ) VALUES (
          ?, ?, ?, ?, ?, 'Hubballi', 'Dharwad', 'Karnataka',
          ?, ?, ?, ?, ?, ?
        )
      `, [
        cid, `CUST-${1000 + i}`, name, mobile, template.village,
        i % 5 === 0 ? 'Wholesale' : 'Retail', template.credit,
        i % 3 === 0 ? 8500 : 0, template.village, template.crop, template.acres
      ]);
    }

    // 13. Sample Completed Sales Invoice & Customer Ledger
    execute(`
      INSERT OR REPLACE INTO sales_invoices (
        id, invoice_number, store_id, customer_id, customer_name, customer_mobile,
        invoice_date, invoice_type, status, payment_status, taxable_value,
        cgst, sgst, igst, total_tax, total_discount, grand_total, amount_received, balance_due,
        payment_mode, is_credit_sale, created_by
      ) VALUES (
        'inv-sample-01', 'INV-2627-0001', 'store-main', 'cust-001', 'Basavaraj Patil', '9880100001',
        '2026-08-01', 'B2C', 'Completed', 'Paid', 2420.00,
        121.00, 121.00, 0, 242.00, 0, 2662.00, 2662.00, 0,
        'Cash', 0, 'usr-sales'
      )
    `);

    execute(`
      INSERT OR REPLACE INTO sales_items (
        id, sales_id, product_id, batch_id, product_name, hsn_code,
        quantity, unit, rate, discount, taxable_value,
        cgst_rate, cgst_amount, sgst_rate, sgst_amount, total_amount, cost_price
      ) VALUES (
        'item-sample-01', 'inv-sample-01', 'prod-009', 'batch-prod-009-STD', 'Neem Coated Urea (IFFCO 45kg Bag)', '3102',
        10, 'Bag', 242.00, 0, 2420.00,
        2.5, 60.50, 2.5, 60.50, 2662.00, 242.00
      )
    `);

    // Customer ledger
    execute(`
      INSERT OR REPLACE INTO customer_transactions (
        id, customer_id, store_id, transaction_date, reference_no, description, debit, credit, balance, created_by
      ) VALUES (
        'ctx-001', 'cust-001', 'store-main', '2026-08-01', 'INV-2627-0001', 'Sale Invoice - Cash', 2662.00, 2662.00, 0, 'usr-sales'
      )
    `);

    // Cash register
    execute(`
      INSERT OR REPLACE INTO cash_registers (
        id, store_id, register_date, opening_cash, cash_sales, expected_closing_cash, actual_closing_cash, status
      ) VALUES (
        'reg-today', 'store-main', '2026-08-10', 5000.00, 2662.00, 7662.00, 7662.00, 'Open'
      )
    `);

    // Audit log
    execute(`
      INSERT OR REPLACE INTO audit_logs (
        id, user_id, username, store_id, action, entity, entity_id, previous_value, new_value
      ) VALUES (
        'audit-seed-01', 'usr-admin', 'admin', 'store-main', 'SEED_DATABASE', 'System', '0', null, 'Seeded initial agri retail store system'
      )
    `);

    // Ensure all existing customer records are formatted with Full Name, Village, Mobile number
    execute(`
      UPDATE customers 
      SET village = COALESCE(NULLIF(village, ''), NULLIF(farm_village, ''), 'Navalgund'),
          mobile = COALESCE(NULLIF(mobile, ''), '9880100000')
      WHERE village IS NULL OR village = '' OR mobile IS NULL OR mobile = ''
    `);

    console.log("Seed data inserted successfully!");
  });
}
