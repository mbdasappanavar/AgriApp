export interface GstCalculationInput {
  taxableValue: number;
  gstRate: number; // e.g. 18 for 18%
  cessRate?: number;
  sellerState?: string;
  buyerState?: string;
  isInterstate?: boolean;
}

export interface GstCalculationResult {
  taxableValue: number;
  gstRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  cessAmount: number;
  totalTax: number;
  totalAmount: number;
  isInterstate: boolean;
}

export function calculateGst(input: GstCalculationInput): GstCalculationResult {
  const taxable = Math.max(0, Number(input.taxableValue) || 0);
  const gstRate = Math.max(0, Number(input.gstRate) || 0);
  const cessRate = Math.max(0, Number(input.cessRate) || 0);

  const sellerState = (input.sellerState || 'Karnataka').trim().toLowerCase();
  const buyerState = (input.buyerState || 'Karnataka').trim().toLowerCase();

  const isInterstate = input.isInterstate !== undefined
    ? input.isInterstate
    : (sellerState !== '' && buyerState !== '' && sellerState !== buyerState);

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (isInterstate) {
    igstRate = gstRate;
    igstAmount = Number(((taxable * igstRate) / 100).toFixed(2));
  } else {
    cgstRate = gstRate / 2;
    sgstRate = gstRate / 2;
    cgstAmount = Number(((taxable * cgstRate) / 100).toFixed(2));
    sgstAmount = Number(((taxable * sgstRate) / 100).toFixed(2));
  }

  const cessAmount = Number(((taxable * cessRate) / 100).toFixed(2));
  const totalTax = Number((cgstAmount + sgstAmount + igstAmount + cessAmount).toFixed(2));
  const totalAmount = Number((taxable + totalTax).toFixed(2));

  return {
    taxableValue: Number(taxable.toFixed(2)),
    gstRate,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    cessAmount,
    totalTax,
    totalAmount,
    isInterstate
  };
}
