import type {
  ApiEnvelope,
  GalleryImage,
  MenuCategory,
  PublicReview,
  RestaurantSettings,
} from "../types/website";

const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000/api/v1";

export const DEFAULT_RESTAURANT_SETTINGS: RestaurantSettings = {
  restaurant_name: "Restaurant",

  logo_url: null,

  address: null,

  phone: null,

  email: null,

  currency: "LKR",

  timezone: "Asia/Colombo",

  service_charge: {
    enabled: false,

    rate: 0,
  },

  tax: {
    enabled: false,

    rate: 0,
  },

  opening_hours: {},

  social_media: {
    facebook: null,

    instagram: null,

    tiktok: null,

    youtube: null,
  },

  website_contact: {
    public_phone: null,

    public_email: null,

    whatsapp: null,

    google_maps_url: null,
  },
};

function apiBaseUrl(): string {
  const value = process.env.RESTAURANT_API_BASE_URL ?? DEFAULT_API_BASE_URL;

  return value.replace(/\/+$/, "");
}

async function fetchPublicApi<T>(path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    headers: {
      Accept: "application/json",
    },

    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Restaurant API request failed with status ${response.status}.`
    );
  }

  const body: ApiEnvelope<T> = await response.json();

  if (!body.success) {
    throw new Error(body.message || "Restaurant API request failed.");
  }

  return body.data;
}

export async function getRestaurantSettings(): Promise<RestaurantSettings> {
  return fetchPublicApi<RestaurantSettings>("/public/restaurant-settings");
}

export async function getWebsiteMenu(search = ""): Promise<MenuCategory[]> {
  const params = new URLSearchParams();

  const value = search.trim();

  if (value !== "") {
    params.set("search", value);
  }

  const query = params.toString();

  return fetchPublicApi<MenuCategory[]>(
    `/public/menu/website${query ? `?${query}` : ""}`
  );
}

export async function getGallery(): Promise<GalleryImage[]> {
  return fetchPublicApi<GalleryImage[]>("/public/gallery");
}

export async function getReviews(limit = 50): Promise<PublicReview[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));

  return fetchPublicApi<PublicReview[]>(`/public/reviews?limit=${safeLimit}`);
}

export function resolveAssetUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const assetBase = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.replace(/\/+$/, "");

  if (!assetBase) {
    return value;
  }

  try {
    const url = new URL(value);

    return `${assetBase}${url.pathname}`;
  } catch {
    return `${assetBase}/${value.replace(/^\/+/, "")}`;
  }
}

export function formatMoney(amount: number, currency = "LKR"): string {
  try {
    return new Intl.NumberFormat("en-LK", {
      style: "currency",

      currency,

      minimumFractionDigits: 0,

      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function publicPhone(settings: RestaurantSettings): string | null {
  return settings.website_contact.public_phone || settings.phone || null;
}

export function publicEmail(settings: RestaurantSettings): string | null {
  return settings.website_contact.public_email || settings.email || null;
}

export function whatsappUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");

  if (digits === "") {
    return null;
  }

  return `https://wa.me/${digits}`;
}
