import { api } from "../lib/api";

import type {
  BusinessDayClosing,
  BusinessDayPreview,
  CloseBusinessDayPayload,
  CloseBusinessDayResult,
} from "./types";

/*
|--------------------------------------------------------------------------
| Current Business Day
|--------------------------------------------------------------------------
*/

export async function getCurrentBusinessDay(): Promise<BusinessDayPreview> {
  const response = await api.get<BusinessDayPreview>("/business-days/current");

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Closing Preview
|--------------------------------------------------------------------------
*/

export async function getBusinessDayClosingPreview(
  businessDayId: number
): Promise<BusinessDayPreview> {
  const response = await api.get<BusinessDayPreview>(
    `/business-days/${businessDayId}/closing-preview`
  );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Close Restaurant Day
|--------------------------------------------------------------------------
*/

export async function closeBusinessDay(
  businessDayId: number,
  payload: CloseBusinessDayPayload
): Promise<CloseBusinessDayResult> {
  const response = await api.post<CloseBusinessDayResult>(
    `/business-days/${businessDayId}/close`,
    payload
  );

  return response.data;
}

/*
|--------------------------------------------------------------------------
| Historical Closing
|--------------------------------------------------------------------------
*/

export async function getBusinessDayClosing(
  closingId: number
): Promise<BusinessDayClosing> {
  const response = await api.get<BusinessDayClosing>(
    `/business-day-closings/${closingId}`
  );

  return response.data;
}
