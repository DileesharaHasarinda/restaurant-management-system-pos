import { API_BASE_URL, api } from "../lib/api";

import {
  DAY_KEYS,
  type DocumentNumbering,
  type NumberingType,
  type OpeningHours,
  type ResetPeriod,
  type RestaurantNumbering,
  type RestaurantSettings,
  type RestaurantSettingsData,
  type UpdateRestaurantSettingsPayload,
} from "./types";

/*
|--------------------------------------------------------------------------
| Internal Types
|--------------------------------------------------------------------------
*/

type UnknownRecord = Record<string, unknown>;

/*
|--------------------------------------------------------------------------
| Primitive Normalizers
|--------------------------------------------------------------------------
*/

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: unknown): UnknownRecord {
  return isRecord(value) ? value : {};
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toStringValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number") {
    return String(value);
  }

  return "";
}

function toNullableString(value: unknown): string | null {
  const result = toStringValue(value).trim();

  return result.length > 0 ? result : null;
}

function toNumber(value: unknown, fallback = 0): number {
  const result = Number(value);

  return Number.isFinite(result) ? result : fallback;
}

function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const result = Number(value);

  return Number.isFinite(result) ? result : null;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === 1 || value === "1" || value === "true") {
    return true;
  }

  if (value === 0 || value === "0" || value === "false") {
    return false;
  }

  return fallback;
}

/*
|--------------------------------------------------------------------------
| Reset Period
|--------------------------------------------------------------------------
*/

function normalizeResetPeriod(value: unknown): ResetPeriod {
  const normalized = toStringValue(value).trim().toUpperCase();

  if (
    normalized === "DAILY" ||
    normalized === "MONTHLY" ||
    normalized === "YEARLY"
  ) {
    return normalized;
  }

  return "NEVER";
}

/*
|--------------------------------------------------------------------------
| Opening Hours
|--------------------------------------------------------------------------
*/

function createDefaultOpeningHours(): OpeningHours {
  return {
    monday: {
      is_open: false,
      open: null,
      close: null,
    },

    tuesday: {
      is_open: false,
      open: null,
      close: null,
    },

    wednesday: {
      is_open: false,
      open: null,
      close: null,
    },

    thursday: {
      is_open: false,
      open: null,
      close: null,
    },

    friday: {
      is_open: false,
      open: null,
      close: null,
    },

    saturday: {
      is_open: false,
      open: null,
      close: null,
    },

    sunday: {
      is_open: false,
      open: null,
      close: null,
    },
  };
}

function normalizeOpeningHours(value: unknown): OpeningHours {
  const source = toRecord(value);

  const result = createDefaultOpeningHours();

  for (const day of DAY_KEYS) {
    const schedule = toRecord(source[day]);

    result[day] = {
      is_open: toBoolean(schedule.is_open),

      open: toNullableString(schedule.open),

      close: toNullableString(schedule.close),
    };
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| Logo URL
|--------------------------------------------------------------------------
*/

function resolveLogoUrl(settings: UnknownRecord): string | null {
  /*
   * Current RestaurantSettingResource already supplies logo_url.
   */

  const explicitUrl = toNullableString(
    settings.logo_url ?? settings.logoUrl ?? settings.logo
  );

  if (explicitUrl) {
    return explicitUrl;
  }

  /*
   * Fallback if only logo_path is ever returned.
   */

  const path = toNullableString(settings.logo_path);

  if (!path) {
    return null;
  }

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  try {
    const apiUrl = new URL(API_BASE_URL, window.location.origin);

    return `${apiUrl.origin}/storage/${path.replace(/^\/+/, "")}`;
  } catch {
    return null;
  }
}

/*
|--------------------------------------------------------------------------
| Restaurant Settings
|--------------------------------------------------------------------------
|
| Current backend RestaurantSettingResource uses nested structures:
|
| tax.enabled
| tax.rate
|
| service_charge.enabled
| service_charge.rate
|
| receipt.header
| receipt.footer
|
| The UI uses a normalized flat RestaurantSettings structure.
|--------------------------------------------------------------------------
*/

function normalizeRestaurantSettings(value: unknown): RestaurantSettings {
  const settings = toRecord(value);

  const tax = toRecord(settings.tax);

  const serviceCharge = toRecord(settings.service_charge);

  const receipt = toRecord(settings.receipt);

  const socialMedia = toRecord(settings.social_media);

  const websiteContact = toRecord(settings.website_contact);

  return {
    id: toNumber(settings.id),

    business_name: toStringValue(settings.business_name),

    legal_name: toNullableString(settings.legal_name),

    phone: toNullableString(settings.phone),

    email: toNullableString(settings.email),

    address: toNullableString(settings.address),

    currency: toStringValue(settings.currency) || "LKR",

    timezone: toStringValue(settings.timezone) || "Asia/Colombo",

    /*
        |--------------------------------------------------------------------------
        | Tax
        |--------------------------------------------------------------------------
        */

    tax_enabled: toBoolean(tax.enabled ?? settings.tax_enabled),

    default_tax_rate: toNumber(tax.rate ?? settings.default_tax_rate),

    /*
        |--------------------------------------------------------------------------
        | Service Charge
        |--------------------------------------------------------------------------
        */

    service_charge_enabled: toBoolean(
      serviceCharge.enabled ?? settings.service_charge_enabled
    ),

    default_service_charge_rate: toNumber(
      serviceCharge.rate ?? settings.default_service_charge_rate
    ),

    /*
        |--------------------------------------------------------------------------
        | Logo
        |--------------------------------------------------------------------------
        */

    logo_path: toNullableString(settings.logo_path),

    logo_url: resolveLogoUrl(settings),

    /*
        |--------------------------------------------------------------------------
        | Receipt
        |--------------------------------------------------------------------------
        */

    receipt_header: toNullableString(receipt.header ?? settings.receipt_header),

    receipt_footer: toNullableString(receipt.footer ?? settings.receipt_footer),

    /*
        |--------------------------------------------------------------------------
        | Website Data
        |--------------------------------------------------------------------------
        */

    opening_hours: normalizeOpeningHours(settings.opening_hours),

    social_media: {
      facebook: toNullableString(socialMedia.facebook),

      instagram: toNullableString(socialMedia.instagram),

      tiktok: toNullableString(socialMedia.tiktok),

      youtube: toNullableString(socialMedia.youtube),
    },

    website_contact: {
      public_phone: toNullableString(websiteContact.public_phone),

      public_email: toNullableString(websiteContact.public_email),

      whatsapp: toNullableString(websiteContact.whatsapp),

      google_maps_url: toNullableString(websiteContact.google_maps_url),
    },
  };
}

/*
|--------------------------------------------------------------------------
| Document Numbering
|--------------------------------------------------------------------------
*/

function detectSequenceType(value: UnknownRecord): NumberingType | null {
  const raw = toStringValue(value.type ?? value.sequence_type ?? value.name)
    .trim()
    .toLowerCase();

  if (raw === "invoice" || raw.includes("invoice")) {
    return "invoice";
  }

  if (raw === "order" || raw.includes("order")) {
    return "order";
  }

  if (raw === "token" || raw.includes("token")) {
    return "token";
  }

  /*
   * PAYMENT exists in the database, but RestaurantSettingsService
   * currently manages invoice/order/token only.
   */

  return null;
}

function defaultSequence(type: NumberingType): DocumentNumbering {
  const defaultPrefixes: Record<NumberingType, string> = {
    invoice: "INV",

    order: "ORD",

    token: "TOK",
  };

  return {
    id: null,

    type,

    prefix: defaultPrefixes[type],

    padding: type === "token" ? 4 : 6,

    reset_period: type === "token" ? "DAILY" : "NEVER",

    current_value: null,
  };
}

function normalizeDocumentSequence(
  value: unknown,
  type: NumberingType
): DocumentNumbering {
  const sequence = toRecord(value);

  const fallback = defaultSequence(type);

  return {
    /*
     * Current DocumentSequenceResource does not expose id.
     */

    id: toNullableNumber(sequence.id),

    type,

    prefix: toStringValue(sequence.prefix) || fallback.prefix,

    padding: toNumber(sequence.padding, fallback.padding),

    reset_period: normalizeResetPeriod(sequence.reset_period),

    /*
     * Current backend property is current_number.
     */

    current_value: toNullableNumber(
      sequence.current_number ??
        sequence.current_value ??
        sequence.current ??
        sequence.next_value
    ),
  };
}

function normalizeNumbering(value: unknown): RestaurantNumbering {
  const result: RestaurantNumbering = {
    invoice: defaultSequence("invoice"),

    order: defaultSequence("order"),

    token: defaultSequence("token"),
  };

  /*
    |--------------------------------------------------------------------------
    | Current Backend Shape
    |--------------------------------------------------------------------------
    |
    | DocumentSequenceResource::collection()
    |
    | [
    |   { type: "invoice", ... },
    |   { type: "order", ... },
    |   { type: "token", ... },
    |   { type: "payment", ... }
    | ]
    |--------------------------------------------------------------------------
    */

  for (const raw of toArray(value)) {
    const record = toRecord(raw);

    const type = detectSequenceType(record);

    if (!type) {
      continue;
    }

    result[type] = normalizeDocumentSequence(record, type);
  }

  /*
    |--------------------------------------------------------------------------
    | Object Fallback
    |--------------------------------------------------------------------------
    |
    | Also support:
    |
    | {
    |   invoice: {...},
    |   order: {...},
    |   token: {...}
    | }
    |--------------------------------------------------------------------------
    */

  if (isRecord(value)) {
    for (const type of ["invoice", "order", "token"] as const) {
      if (value[type] !== undefined) {
        result[type] = normalizeDocumentSequence(value[type], type);
      }
    }
  }

  return result;
}

/*
|--------------------------------------------------------------------------
| Settings Envelope
|--------------------------------------------------------------------------
*/

function normalizeSettingsData(value: unknown): RestaurantSettingsData {
  const response = toRecord(value);

  return {
    settings: normalizeRestaurantSettings(response.settings),

    numbering: normalizeNumbering(response.numbering),
  };
}

/*
|--------------------------------------------------------------------------
| GET
|--------------------------------------------------------------------------
*/

export async function getRestaurantSettings(): Promise<RestaurantSettingsData> {
  const response = await api.get<unknown>("/restaurant/settings");

  return normalizeSettingsData(response.data);
}

/*
|--------------------------------------------------------------------------
| UPDATE
|--------------------------------------------------------------------------
*/

export async function updateRestaurantSettings(
  payload: UpdateRestaurantSettingsPayload
): Promise<RestaurantSettingsData> {
  const response = await api.put<unknown>("/restaurant/settings", payload);

  return normalizeSettingsData(response.data);
}

/*
|--------------------------------------------------------------------------
| UPLOAD LOGO
|--------------------------------------------------------------------------
*/

export async function uploadRestaurantLogo(
  file: File
): Promise<RestaurantSettings> {
  const formData = new FormData();

  formData.append("logo", file);

  const response = await api.postForm<unknown>(
    "/restaurant/settings/logo",
    formData
  );

  return normalizeRestaurantSettings(response.data);
}

/*
|--------------------------------------------------------------------------
| REMOVE LOGO
|--------------------------------------------------------------------------
*/

export async function removeRestaurantLogo(): Promise<RestaurantSettings> {
  const response = await api.delete<unknown>("/restaurant/settings/logo");

  return normalizeRestaurantSettings(response.data);
}
