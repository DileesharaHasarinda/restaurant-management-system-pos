import { api } from "../lib/api";

import type {
  GalleryImage,
  Pagination,
  Review,
  ReviewFilters,
  ReviewListResult,
  UpdateGalleryPayload,
  UploadGalleryPayload,
} from "./types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function paginationFromMeta(
  meta: Record<string, unknown> | undefined
): Pagination {
  const value = meta?.pagination;

  if (!isRecord(value)) {
    return {
      current_page: 1,
      per_page: 20,
      total: 0,
      last_page: 1,
    };
  }

  return {
    current_page: numberValue(value.current_page, 1),

    per_page: numberValue(value.per_page, 20),

    total: numberValue(value.total, 0),

    last_page: numberValue(value.last_page, 1),
  };
}

/*
  |--------------------------------------------------------------------------
  | Reviews
  |--------------------------------------------------------------------------
  */

export async function getReviews(
  filters: ReviewFilters
): Promise<ReviewListResult> {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));

  params.set("per_page", String(filters.perPage));

  if (filters.search.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.rating !== null) {
    params.set("rating", String(filters.rating));
  }

  if (filters.visibility) {
    params.set("visibility", filters.visibility);
  }

  const response = await api.get<Review[]>(`/reviews?${params.toString()}`);

  return {
    reviews: response.data,

    pagination: paginationFromMeta(response.meta),
  };
}

export async function approveReview(reviewId: number): Promise<Review> {
  const response = await api.patch<Review>(`/reviews/${reviewId}/approve`);

  return response.data;
}

export async function rejectReview(reviewId: number): Promise<Review> {
  const response = await api.patch<Review>(`/reviews/${reviewId}/reject`);

  return response.data;
}

export async function updateReviewVisibility(
  reviewId: number,
  isVisible: boolean
): Promise<Review> {
  const response = await api.patch<Review>(`/reviews/${reviewId}/visibility`, {
    is_visible: isVisible,
  });

  return response.data;
}

export async function deleteReview(reviewId: number): Promise<void> {
  await api.delete<null>(`/reviews/${reviewId}`);
}

/*
  |--------------------------------------------------------------------------
  | Gallery
  |--------------------------------------------------------------------------
  */

export async function getGalleryImages(): Promise<GalleryImage[]> {
  const response = await api.get<GalleryImage[]>("/gallery");

  return response.data;
}

export async function uploadGalleryImage(
  payload: UploadGalleryPayload
): Promise<GalleryImage> {
  const body = new FormData();

  body.append("image", payload.image);

  if (payload.caption.trim()) {
    body.append("caption", payload.caption.trim());
  }

  if (payload.altText.trim()) {
    body.append("alt_text", payload.altText.trim());
  }

  body.append("sort_order", String(payload.sortOrder));

  body.append("is_active", payload.isActive ? "1" : "0");

  const response = await api.postForm<GalleryImage>("/gallery", body);

  return response.data;
}

export async function updateGalleryImage(
  imageId: number,
  payload: UpdateGalleryPayload
): Promise<GalleryImage> {
  const response = await api.put<GalleryImage>(`/gallery/${imageId}`, payload);

  return response.data;
}

export async function updateGalleryState(
  imageId: number,
  isActive: boolean
): Promise<GalleryImage> {
  const response = await api.patch<GalleryImage>(`/gallery/${imageId}/state`, {
    is_active: isActive,
  });

  return response.data;
}
