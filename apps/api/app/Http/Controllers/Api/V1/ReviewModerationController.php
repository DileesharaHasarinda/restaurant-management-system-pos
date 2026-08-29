<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ReviewResource;
use App\Models\Review;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReviewModerationController extends Controller
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function index(
        Request $request
    ): JsonResponse {
        $validated =
            $request->validate([
                'search' => [
                    'nullable',
                    'string',
                    'max:190',
                ],

                'status' => [
                    'nullable',
                    Rule::in([
                        Review::STATUS_PENDING,
                        Review::STATUS_APPROVED,
                        Review::STATUS_REJECTED,
                    ]),
                ],

                'rating' => [
                    'nullable',
                    'integer',
                    'min:1',
                    'max:5',
                ],

                'visibility' => [
                    'nullable',
                    Rule::in([
                        'VISIBLE',
                        'HIDDEN',
                    ]),
                ],

                'per_page' => [
                    'nullable',
                    'integer',
                    'min:1',
                    'max:100',
                ],
            ]);

        $query =
            Review::query()
            ->with(
                'reviewedBy'
            )
            ->latest();

        if (
            filled(
                $validated['search']
                    ?? null
            )
        ) {
            $search =
                trim(
                    $validated['search']
                );

            $query->where(
                function ($query) use ($search) {
                    $query
                        ->where(
                            'customer_name',
                            'like',
                            "%{$search}%"
                        )
                        ->orWhere(
                            'review',
                            'like',
                            "%{$search}%"
                        );
                }
            );
        }

        if (
            filled(
                $validated['status']
                    ?? null
            )
        ) {
            $query->where(
                'status',
                $validated['status']
            );
        }

        if (
            isset(
                $validated['rating']
            )
        ) {
            $query->where(
                'rating',
                $validated['rating']
            );
        }

        if (
            isset(
                $validated['visibility']
            )
        ) {
            $query->where(
                'is_visible',
                $validated['visibility']
                    === 'VISIBLE'
            );
        }

        $reviews =
            $query->paginate(
                $validated['per_page']
                    ?? 20
            );

        $items =
            $reviews
            ->getCollection()
            ->map(
                fn(Review $review) => (
                    new ReviewResource(
                        $review
                    )
                )->resolve(
                    $request
                )
            )
            ->values()
            ->all();

        return ApiResponse::success(
            data: $items,

            message: 'Reviews retrieved successfully.',

            meta: [
                'pagination' => [
                    'current_page' =>
                    $reviews->currentPage(),

                    'per_page' =>
                    $reviews->perPage(),

                    'total' =>
                    $reviews->total(),

                    'last_page' =>
                    $reviews->lastPage(),
                ],
            ]
        );
    }

    public function approve(
        Request $request,
        Review $review
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $review->forceFill([
            'status' =>
            Review::STATUS_APPROVED,

            'reviewed_by' =>
            $actor->id,

            'reviewed_at' =>
            now(),

            'is_visible' =>
            true,
        ])->save();

        $this->audit(
            $actor,
            $review,
            'REVIEW_APPROVED'
        );

        return $this->response(
            $request,
            $review,
            'Review approved successfully.'
        );
    }

    public function reject(
        Request $request,
        Review $review
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $review->forceFill([
            'status' =>
            Review::STATUS_REJECTED,

            'reviewed_by' =>
            $actor->id,

            'reviewed_at' =>
            now(),

            'is_visible' =>
            false,
        ])->save();

        $this->audit(
            $actor,
            $review,
            'REVIEW_REJECTED'
        );

        return $this->response(
            $request,
            $review,
            'Review rejected successfully.'
        );
    }

    public function visibility(
        Request $request,
        Review $review
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $validated =
            $request->validate([
                'is_visible' => [
                    'required',
                    'boolean',
                ],
            ]);

        $review->forceFill([
            'is_visible' =>
            (bool)
            $validated['is_visible'],
        ])->save();

        $this->audit(
            $actor,
            $review,
            $review->is_visible
                ? 'REVIEW_SHOWN'
                : 'REVIEW_HIDDEN'
        );

        return $this->response(
            $request,
            $review,
            $review->is_visible
                ? 'Review made visible successfully.'
                : 'Review hidden successfully.'
        );
    }

    public function destroy(
        Request $request,
        Review $review
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $reviewId =
            $review->id;

        $customerName =
            $review->customer_name;

        $review->delete();

        $this->auditLogger->record(
            action: 'REVIEW_DELETED',

            entityType: 'review',

            entityId: $reviewId,

            metadata: [
                'customer_name' =>
                $customerName,
            ],

            userId: $actor->id
        );

        return ApiResponse::success(
            data: null,
            message: 'Review deleted successfully.'
        );
    }

    private function response(
        Request $request,
        Review $review,
        string $message
    ): JsonResponse {
        $review->load(
            'reviewedBy'
        );

        return ApiResponse::success(
            data: (
                new ReviewResource(
                    $review
                )
            )->resolve(
                $request
            ),

            message: $message
        );
    }

    private function audit(
        User $actor,
        Review $review,
        string $action
    ): void {
        $this->auditLogger->record(
            action: $action,

            entityType: 'review',

            entityId: $review->id,

            metadata: [
                'status' =>
                $review->status,

                'is_visible' =>
                $review->is_visible,
            ],

            userId: $actor->id
        );
    }
}
