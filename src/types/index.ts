export interface User {
  id: string;
  username: string;
  name: string;
  email?: string;
  mobile?: string;
  roleId: string;
  roleName: string;
  roleCode: string;
  storeId: string;
  storeName: string;
  permissions: string[];
}

export interface Store {
  id: string;
  name: string;
  code: string;
  address?: string;
  city?: string;
  state: string;
  pin?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  is_active: number;
}

export interface Product {
  id: string;
  code: string;
  sku: string;
  name: string;
  short_name?: string;
  description?: string;
  category_id: string;
  category_name?: string;
  brand_id?: string;
  brand_name?: string;
  product_type: string;
  crop?: string;
  pack_size: string;
  unit: string;
  hsn_code: string;
  gst_rate: number;
  cgst: number;
  sgst: number;
  igst: number;
  purchase_price: number;
  avg_purchase_price: number;
  mrp: number;
  selling_price: number;
  wholesale_price: number;
  min_stock: number;
  reorder_level: number;
  requires_batch: number;
  primary_barcode?: string;
  current_stock?: number;
}

export interface Batch {
  id: string;
  product_id: string;
  batch_number: string;
  store_id: string;
  mfg_date?: string;
  expiry_date: string;
  supplier_id?: string;
  supplier_name?: string;
  purchase_price: number;
  mrp: number;
  initial_qty: number;
  current_qty: number;
  is_active: number;
}

export interface Customer {
  id: string;
  customer_code: string;
  name: string;
  mobile?: string;
  email?: string;
  village?: string;
  taluk?: string;
  district?: string;
  state: string;
  gstin?: string;
  customer_type: string;
  credit_limit?: number;
  current_outstanding: number;
  farm_village?: string;
  crop?: string;
  land_area_acres?: number;
}

export interface Supplier {
  id: string;
  supplier_code: string;
  company_name: string;
  contact_person?: string;
  mobile?: string;
  email?: string;
  address?: string;
  city?: string;
  state: string;
  pin?: string;
  gstin?: string;
  pan?: string;
  payment_terms?: string;
  credit_limit?: number;
  current_outstanding: number;
}

export interface SalesInvoice {
  id: string;
  invoice_number: string;
  store_id: string;
  store_name?: string;
  customer_id?: string;
  customer_name: string;
  customer_gstin?: string;
  customer_mobile?: string;
  invoice_date: string;
  invoice_type: string;
  status: string;
  payment_status: string;
  taxable_value: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_tax: number;
  total_discount: number;
  grand_total: number;
  amount_received: number;
  balance_due: number;
  payment_mode: string;
  is_credit_sale: number;
  created_by: string;
  created_at: string;
  cancel_reason?: string;
}

export interface SalesItem {
  id: string;
  sales_id: string;
  product_id: string;
  batch_id?: string;
  product_name: string;
  hsn_code: string;
  quantity: number;
  unit: string;
  rate: number;
  discount: number;
  taxable_value: number;
  cgst_rate: number;
  cgst_amount: number;
  sgst_rate: number;
  sgst_amount: number;
  igst_rate: number;
  igst_amount: number;
  total_amount: number;
}

export interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  supplier_invoice_no: string;
  store_id: string;
  supplier_id: string;
  supplier_name?: string;
  invoice_date: string;
  status: string;
  taxable_value: number;
  total_tax: number;
  grand_total: number;
  paid_amount: number;
  balance_due: number;
  created_by: string;
}

export interface Category {
  id: string;
  name: string;
  code: string;
  parent_id?: string;
  description?: string;
}

export interface Brand {
  id: string;
  name: string;
  code: string;
  manufacturer?: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  is_base: number;
}

export interface CompanySettings {
  id: number;
  business_name: string;
  legal_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  pan?: string;
  gstin?: string;
  state: string;
  state_code: string;
  financial_year: string;
  currency: string;
  invoice_prefix: string;
  po_prefix: string;
  terms_and_conditions?: string;
  bank_details?: string;
}
