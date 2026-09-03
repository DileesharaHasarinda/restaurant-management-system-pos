export const DAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type DayKey = (typeof DAY_KEYS)[number];

export type ResetPeriod = "NEVER" | "DAILY" | "MONTHLY" | "YEARLY";

export type NumberingType = "invoice" | "order" | "token";

export interface OpeningHour {
  is_open: boolean;

  open: string | null;

  close: string | null;
}

export type OpeningHours = Record<DayKey, OpeningHour>;

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
  id: number;

  business_name: string;

  legal_name: string | null;

  phone: string | null;

  email: string | null;

  address: string | null;

  currency: string;

  timezone: string;

  tax_enabled: boolean;

  default_tax_rate: number;

  service_charge_enabled: boolean;

  default_service_charge_rate: number;

  logo_path: string | null;

  logo_url: string | null;

  receipt_header: string | null;

  receipt_footer: string | null;

  opening_hours: OpeningHours;

  social_media: SocialMedia;

  website_contact: WebsiteContact;
}

export interface DocumentNumbering {
  id: number | null;

  type: NumberingType;

  prefix: string;

  padding: number;

  reset_period: ResetPeriod;

  current_value: number | null;
}

export interface RestaurantNumbering {
  invoice: DocumentNumbering;

  order: DocumentNumbering;

  token: DocumentNumbering;
}

export interface RestaurantSettingsData {
  settings: RestaurantSettings;

  numbering: RestaurantNumbering;
}

export interface OpeningHourForm {
  isOpen: boolean;

  open: string;

  close: string;
}

export type OpeningHoursForm = Record<DayKey, OpeningHourForm>;

export interface RestaurantSettingsForm {
  businessName: string;

  legalName: string;

  phone: string;

  email: string;

  address: string;

  currency: string;

  timezone: string;

  taxEnabled: boolean;

  defaultTaxRate: string;

  serviceChargeEnabled: boolean;

  defaultServiceChargeRate: string;

  receiptHeader: string;

  receiptFooter: string;

  openingHours: OpeningHoursForm;

  socialMedia: {
    facebook: string;

    instagram: string;

    tiktok: string;

    youtube: string;
  };

  websiteContact: {
    publicPhone: string;

    publicEmail: string;

    whatsapp: string;

    googleMapsUrl: string;
  };

  numbering: {
    invoice: {
      prefix: string;

      padding: string;

      resetPeriod: ResetPeriod;
    };

    order: {
      prefix: string;

      padding: string;

      resetPeriod: ResetPeriod;
    };

    token: {
      prefix: string;

      padding: string;

      resetPeriod: ResetPeriod;
    };
  };
}

export interface UpdateRestaurantSettingsPayload {
  business_name: string;

  legal_name: string | null;

  phone: string | null;

  email: string | null;

  address: string | null;

  currency: string;

  timezone: string;

  tax_enabled: boolean;

  default_tax_rate: number;

  service_charge_enabled: boolean;

  default_service_charge_rate: number;

  receipt_header: string | null;

  receipt_footer: string | null;

  opening_hours: OpeningHours;

  social_media: SocialMedia;

  website_contact: WebsiteContact;

  numbering: {
    invoice: {
      prefix: string;

      padding: number;

      reset_period: ResetPeriod;
    };

    order: {
      prefix: string;

      padding: number;

      reset_period: ResetPeriod;
    };

    token: {
      prefix: string;

      padding: number;

      reset_period: ResetPeriod;
    };
  };
}
