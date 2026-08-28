import { api } from "../../api";

import type {
  BusinessDayClosing,
  BusinessDayPreview,
  CloseBusinessDayPayload,
  CloseBusinessDayResult,
  OpenBusinessDayPayload,
  OpenBusinessDayResult,
} from "./types";

const EMPTY_PREVIEW: BusinessDayPreview = {
  business_day: null,
  blockers: null,
  summary: null,
  closing: null,
};

export async function openBusinessDay(
  payload: OpenBusinessDayPayload
): Promise<OpenBusinessDayResult> {
  const response = await api.post<OpenBusinessDayResult>(
    "/business-days/open",
    payload
  );

  return response.data;
}

export async function getCurrentBusinessDay(): Promise<BusinessDayPreview> {
  const response = await api.get<BusinessDayPreview | null>(
    "/business-days/current"
  );

  return response.data ?? EMPTY_PREVIEW;
}

export async function getBusinessDayPreview(
  businessDayId: number
): Promise<BusinessDayPreview> {
  const response = await api.get<BusinessDayPreview>(
    `/business-days/${businessDayId}/closing-preview`
  );

  return response.data;
}

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

export async function getBusinessDayClosing(
  closingId: number
): Promise<BusinessDayClosing> {
  const response = await api.get<BusinessDayClosing>(
    `/business-day-closings/${closingId}`
  );

  return response.data;
}
