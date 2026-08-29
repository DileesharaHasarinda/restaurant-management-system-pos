<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\PublicApi\StorePublicReviewRequest;
use App\Http\Resources\PublicGalleryImageResource;
use App\Http\Resources\PublicReviewResource;
use App\Models\GalleryImage;
use App\Models\Review;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicWebsiteController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Public Gallery
    |--------------------------------------------------------------------------
    |
    | Only enabled gallery images are exposed publicly.
    |
    */

    public function gallery(
        Request $request
    ): JsonResponse {
        $images =
            GalleryImage::query()
            ->where(
                'is_active',
                true
            )
            ->orderBy(
                'sort_order'
            )
            ->orderBy(
                'id'
            )
            ->get();

        $data =
            $images
            ->map(
                fn(
                    GalleryImage $image
                ): array => (
                    new PublicGalleryImageResource(
                        $image
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $data,

            message: 'Public gallery retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Approved Public Reviews
    |--------------------------------------------------------------------------
    |
    | A review is public only when:
    |
    | status = APPROVED
    | is_visible = true
    |
    | Rejected, pending and hidden reviews are never returned.
    |
    */

    public function reviews(
        Request $request
    ): JsonResponse {
        $limit =
            max(
                1,
                min(
                    (int)
                    $request->query(
                        'limit',
                        50
                    ),
                    100
                )
            );

        $featuredOnly =
            filter_var(
                $request->query(
                    'featured',
                    false
                ),
                FILTER_VALIDATE_BOOLEAN
            );

        $query =
            Review::query()
            ->where(
                'status',
                Review::STATUS_APPROVED
            )
            ->where(
                'is_visible',
                true
            );

        if (
            $featuredOnly
        ) {
            $query->where(
                'is_featured',
                true
            );
        }

        $reviews =
            $query
            ->orderByDesc(
                'is_featured'
            )
            ->orderByDesc(
                'reviewed_at'
            )
            ->orderByDesc(
                'id'
            )
            ->limit(
                $limit
            )
            ->get();

        $data =
            $reviews
            ->map(
                fn(
                    Review $review
                ): array => (
                    new PublicReviewResource(
                        $review
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $data,

            message: 'Approved reviews retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Submit Public Review
    |--------------------------------------------------------------------------
    |
    | Customers submit:
    |
    | - customer_name
    | - rating
    | - review
    |
    | customer_email remains optional for backwards compatibility.
    |
    | Every new review starts as PENDING and hidden from the public website.
    | The moderation endpoint must explicitly approve it before publication.
    |
    */

    public function storeReview(
        StorePublicReviewRequest $request
    ): JsonResponse {
        $data =
            $request->validated();

        $review =
            Review::query()
            ->create([
                'customer_name' =>
                $data['customer_name'],

                'customer_email' =>
                $data['customer_email']
                    ?? null,

                'rating' =>
                (int)
                $data['rating'],

                'review' =>
                $data['review'],

                'status' =>
                Review::STATUS_PENDING,

                'reviewed_by' =>
                null,

                'reviewed_at' =>
                null,

                'is_featured' =>
                false,

                /*
                     * Defense in depth:
                     *
                     * Even if somebody changes status directly in the
                     * database, a new review does not become public until
                     * moderation explicitly enables visibility.
                     */
                'is_visible' =>
                false,
            ]);

        return ApiResponse::success(
            data: [
                'id' =>
                (int)
                $review->id,

                'status' =>
                Review::STATUS_PENDING,
            ],

            message: 'Thank you. Your review was submitted and is awaiting approval.',

            status: 201
        );
    }
}
