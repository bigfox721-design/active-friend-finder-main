export type Product = {
  id: string;
  name: string;
  unit: string;
  active: boolean;
  created_at: string;
  code?: string | null;
  parent_id?: string | null;
  is_sub?: boolean;
};

export type ProductionEntry = {
  id: string;
  product_id: string;
  entry_date: string;
  target_qty: number;
  completed_qty: number;
  notes: string | null;
  manpower: number | null;
  delay_reason: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EntryWithProduct = ProductionEntry & { product: Product };
