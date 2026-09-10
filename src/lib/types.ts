export type Category = 'Bites' | 'Mocktails' | 'Desserts' | 'Drinks' | 'Specials' | 'Custom';
export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  category: Category;
  emoji: string;
  kids?: boolean;
  options?: string[];
  available?: boolean;
};
export type CartLine = { id: string; quantity: number; note: string; option: string };
export type PricedLine = CartLine & {
  name: string;
  price: number | null;
  category: Category;
  kids?: boolean;
};
export type Promotion = 'best' | 'none' | 'sip' | 'bogo' | 'ultimate';
export type Quote = {
  lines: PricedLine[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  pending: boolean;
  promotion: string;
  revision: number;
};
export type Status = 'NEW' | 'ACCEPTED' | 'MAKING' | 'READY' | 'COMPLETED';
export const statuses: Status[] = ['NEW', 'ACCEPTED', 'MAKING', 'READY', 'COMPLETED'];
export type Order = Quote & {
  id: string;
  name: string;
  status: Status;
  createdAt: number;
  customer: string;
  requestId: string;
};
export type Settings = {
  open: boolean;
  revision: number;
  overrides: Record<string, { price?: number; available?: boolean }>;
  promotions: boolean;
};
