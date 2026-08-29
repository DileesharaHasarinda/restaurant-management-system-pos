export type DayKey =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface OpeningHour {
  is_open: boolean;
  open: string | null;
  close: string | null;
}

export type OpeningHours = Partial<Record<DayKey, OpeningHour>>;

export interface SocialMedia {
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
}

export interface WebsiteContact {
  public_phone: string | null;
  public_email: string | null;
  whatsapp: string | null;
  google_maps_url: string | null;
}

export interface RestaurantSettings {
  restaurant_name: string;
  logo_url: string | null;

  address: string | null;
  phone: string | null;
  email: string | null;

  currency: string;
  timezone: string;

  service_charge: {
    enabled: boolean;
    rate: number;
  };

  tax: {
    enabled: boolean;
    rate: number;
  };

  opening_hours: OpeningHours;

  social_media: SocialMedia;

  website_contact: WebsiteContact;
}

export interface MenuVariant {
  id: number;
  sku: string;
  name: string;
  price: number;
  is_default: boolean;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface MenuAddon {
  id: number;
  consumes_inventory: boolean;
  addon_group_id: number;
  sku: string;
  name: string;
  base_price: number;
  price: number;
  is_available: boolean;
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
}

export interface MenuCategorySummary {
  id: number;
  name: string;
  slug: string;
}

export interface MenuItem {
  id: number;
  category_id: number;
  sku: string;

  name: string;
  slug: string;

  description: string | null;
  photo_url: string | null;

  price: number;
  tax_rate: number;

  is_available: boolean;
  is_active: boolean;

  is_visible_on_website: boolean;
  is_visible_on_qr: boolean;

  has_variants: boolean;
  sort_order: number;

  category: MenuCategorySummary | null;

  variants: MenuVariant[];

  addons: MenuAddon[];

  created_at: string | null;
  updated_at: string | null;
}

export interface MenuCategory {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  items: MenuItem[];
}

export interface GalleryImage {
  id: number;
  title: string | null;
  alt_text: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface PublicReview {
  id: number;
  customer_name: string;
  rating: number;
  review: string;
  is_featured: boolean;
  created_at: string | null;
}

export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
}
