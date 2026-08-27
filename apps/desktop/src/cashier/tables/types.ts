/*
|--------------------------------------------------------------------------
| Cashier Table Session
|--------------------------------------------------------------------------
|
| Matches Laravel TableSessionResource.
|--------------------------------------------------------------------------
*/

export interface CashierTableSession {
  id: number;

  session_number: string;

  public_token: string;

  business_day_id: number;

  table_id: number;

  guest_count: number;

  opened_source: string;

  status: string;

  opened_at: string | null;

  closed_at: string | null;

  close_reason: string | null;

  last_activity_at: string | null;
}

/*
|--------------------------------------------------------------------------
| Cashier Table QR Token
|--------------------------------------------------------------------------
|
| Matches Laravel TableQrTokenResource.
|--------------------------------------------------------------------------
*/

export interface CashierTableQrToken {
  id: number;

  token: string;

  order_url: string;

  is_active: boolean;

  expires_at: string | null;

  last_scanned_at: string | null;

  created_at: string | null;
}

/*
|--------------------------------------------------------------------------
| Cashier Table
|--------------------------------------------------------------------------
|
| Matches Laravel TableResource.
|--------------------------------------------------------------------------
*/

export interface CashierTable {
  id: number;

  table_number: number;

  code: string;

  name: string;

  area: string | null;

  capacity: number;

  status: string;

  qr_ordering_enabled: boolean;

  is_active: boolean;

  sort_order: number;

  notes: string | null;

  qr: CashierTableQrToken | null;

  current_session: CashierTableSession | null;

  created_at: string | null;

  updated_at: string | null;
}

export type CashierTableStatusFilter =
  "ALL" | "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "OUT_OF_SERVICE";
