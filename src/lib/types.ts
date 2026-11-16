export type Category = 'Bites' | 'Mocktails' | 'Desserts' | 'Drinks' | 'Specials' | 'Custom';
export type MenuItem = {
  id: string;
  name: string;
  description: string;
  price: number | null;
  category: Category;
  emoji: string;
  image?: string;
  retired?: boolean;
  bundle?: { id: string; quantity: number; label?: string }[];
  kids?: boolean;
  options?: string[];
  available?: boolean;
  special?: boolean;
  seasonal?: boolean;
  visibility?: 'order' | 'menu' | 'both';
};
export type CartLine = { id: string; quantity: number; note: string; option: string };
export type PricedLine = CartLine & {
  name: string;
  price: number | null;
  category: Category;
  kids?: boolean;
  contents?: { name: string; quantity: number }[];
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
  offerId?: string;
  coupon?: string;
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
  paymentStatus?: 'unconfirmed' | 'confirmed';
};
export type Settings = {
  open: boolean;
  revision: number;
  overrides: Record<
    string,
    Partial<
      Pick<
        MenuItem,
        | 'name'
        | 'description'
        | 'category'
        | 'price'
        | 'available'
        | 'special'
        | 'seasonal'
        | 'visibility'
      >
    >
  >;
  additions?: MenuItem[];
  removed?: string[];
  promotions: boolean;
  seasonal?: {
    thanksgiving: boolean;
    decorations: boolean;
    animations: boolean;
    turkey?: boolean;
    pumpkins?: boolean;
    leaves?: boolean;
    fallingLeaves?: boolean;
    confetti?: boolean;
    seasonalAnnouncements?: boolean;
    farm?: boolean;
    other?: boolean;
    lightweight?: boolean;
  };
  announcements?: AnnouncementSettings;
  offers?: Offer[];
};

export type Offer = {
  id: string;
  name: string;
  enabled: boolean;
  kind: 'sip' | 'bogo' | 'ultimate' | 'fixed' | 'percent' | 'free';
  eligibility: 'cart' | 'coupon' | 'manager' | 'member';
  starts: string;
  expires: string;
  minimum: number;
  requiredItem: string;
  quantity: number;
  amount: number;
  limit: number;
  couponHash?: string;
  couponConfigured?: boolean;
};

export type Announcement = {
  id: string;
  text: string;
  icon: string;
  image: string;
  enabled: boolean;
  seasonal: boolean;
  starts: string;
  expires: string;
};
export type AnnouncementSettings = {
  mode: 'rotating' | 'single' | 'decorations';
  items: Announcement[];
};
