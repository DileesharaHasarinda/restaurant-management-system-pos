export type ReviewStatus = "PENDING" | "APPROVED" | "REJECTED";

export type ReviewVisibility = "" | "VISIBLE" | "HIDDEN";

export interface ReviewedBy {
  id: number;
  name: string;
}

export interface Review {
  id: number;

  customer_name: string;

  rating: number;

  review: string;

  status: ReviewStatus;

  is_featured: boolean;

  is_visible: boolean;

  reviewed_by: ReviewedBy | null;

  reviewed_at: string | null;

  created_at: string | null;

  updated_at: string | null;
}

export interface Pagination {
  current_page: number;

  per_page: number;

  total: number;

  last_page: number;
}

export interface ReviewFilters {
  search: string;

  status: ReviewStatus | "";

  rating: number | null;

  visibility: ReviewVisibility;

  page: number;

  perPage: number;
}

export interface ReviewListResult {
  reviews: Review[];

  pagination: Pagination;
}

export interface GalleryImage {
  id: number;

  caption: string | null;

  alt_text: string | null;

  image_url: string | null;

  sort_order: number;

  is_active: boolean;

  created_at: string | null;

  updated_at: string | null;
}

export interface UploadGalleryPayload {
  image: File;

  caption: string;

  altText: string;

  sortOrder: number;

  isActive: boolean;
}

export interface UpdateGalleryPayload {
  caption: string | null;

  alt_text: string | null;

  sort_order: number;
}
