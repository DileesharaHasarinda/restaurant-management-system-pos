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
    | Approved Reviews
    |--------------------------------------------------------------------------
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
    | Submit Review
    |--------------------------------------------------------------------------
    |
    | Public reviews are NEVER published immediately.
    |
    | Every new review begins as PENDING and must later be approved
    | through the restaurant moderation workflow.
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
