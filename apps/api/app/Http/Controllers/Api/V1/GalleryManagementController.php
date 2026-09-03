<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\WebsiteRealtimeUpdated;
use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Website\StoreGalleryImageRequest;
use App\Http\Requests\Api\V1\Website\UpdateGalleryImageRequest;
use App\Http\Resources\GalleryImageResource;
use App\Models\GalleryImage;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Throwable;

class GalleryManagementController extends Controller
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Gallery Index
    |--------------------------------------------------------------------------
    */

    public function index(
        Request $request
    ): JsonResponse {
        $images =
            GalleryImage::query()
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
                ) => (
                    new GalleryImageResource(
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

            message: 'Gallery images retrieved successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Upload Gallery Image
    |--------------------------------------------------------------------------
    */

    public function store(
        StoreGalleryImageRequest $request
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $path =
            $request
            ->file(
                'image'
            )
            ->store(
                'website/gallery',
                'public'
            );

        try {
            $image =
                GalleryImage::query()
                ->create([
                    'title' =>
                    $request->validated(
                        'caption'
                    ),

                    'image_path' =>
                    $path,

                    'alt_text' =>
                    $request->validated(
                        'alt_text'
                    ),

                    'sort_order' =>
                    (int)
                    (
                        $request->validated(
                            'sort_order'
                        )
                        ?? 0
                    ),

                    'is_active' =>
                    (bool)
                    (
                        $request->validated(
                            'is_active'
                        )
                        ?? true
                    ),

                    'uploaded_by' =>
                    $actor->id,
                ]);
        } catch (
            Throwable $exception
        ) {
            Storage::disk(
                'public'
            )->delete(
                $path
            );

            throw $exception;
        }

        $this->auditLogger->record(
            action: 'GALLERY_IMAGE_UPLOADED',

            entityType: 'gallery_image',

            entityId: $image->id,

            metadata: [
                'image_path' =>
                $path,
            ],

            userId: $actor->id
        );

        /*
        |--------------------------------------------------------------------------
        | Public Website Realtime Invalidation
        |--------------------------------------------------------------------------
        */

        $this->broadcastGalleryUpdate(
            $image->id,
            'GALLERY_IMAGE_UPLOADED'
        );

        return ApiResponse::success(
            data: (
                new GalleryImageResource(
                    $image
                )
            )->resolve(
                $request
            ),

            message: 'Gallery image uploaded successfully.',

            status: 201
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Update Gallery Image
    |--------------------------------------------------------------------------
    |
    | Handles:
    |
    | - caption
    | - alt text
    | - sort order
    |--------------------------------------------------------------------------
    */

    public function update(
        UpdateGalleryImageRequest $request,
        GalleryImage $galleryImage
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $validated =
            $request->validated();

        $galleryImage->forceFill([
            'title' =>
            $validated['caption']
                ?? null,

            'alt_text' =>
            $validated['alt_text']
                ?? null,

            'sort_order' =>
            (int)
            $validated['sort_order'],
        ])->save();

        $this->auditLogger->record(
            action: 'GALLERY_IMAGE_UPDATED',

            entityType: 'gallery_image',

            entityId: $galleryImage->id,

            metadata: [
                'sort_order' =>
                $galleryImage->sort_order,
            ],

            userId: $actor->id
        );

        $this->broadcastGalleryUpdate(
            $galleryImage->id,
            'GALLERY_IMAGE_UPDATED'
        );

        return ApiResponse::success(
            data: (
                new GalleryImageResource(
                    $galleryImage
                )
            )->resolve(
                $request
            ),

            message: 'Gallery image updated successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Gallery Visibility / State
    |--------------------------------------------------------------------------
    */

    public function updateState(
        Request $request,
        GalleryImage $galleryImage
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $validated =
            $request->validate([
                'is_active' => [
                    'required',
                    'boolean',
                ],
            ]);

        $galleryImage->forceFill([
            'is_active' =>
            (bool)
            $validated['is_active'],
        ])->save();

        $action =
            $galleryImage->is_active
            ? 'GALLERY_IMAGE_ENABLED'
            : 'GALLERY_IMAGE_DISABLED';

        $this->auditLogger->record(
            action: $action,

            entityType: 'gallery_image',

            entityId: $galleryImage->id,

            metadata: [
                'is_active' =>
                $galleryImage->is_active,
            ],

            userId: $actor->id
        );

        $this->broadcastGalleryUpdate(
            $galleryImage->id,
            $action
        );

        return ApiResponse::success(
            data: (
                new GalleryImageResource(
                    $galleryImage
                )
            )->resolve(
                $request
            ),

            message: $galleryImage->is_active
                ? 'Gallery image enabled successfully.'
                : 'Gallery image disabled successfully.'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Public Gallery Realtime Invalidation
    |--------------------------------------------------------------------------
    |
    | No image metadata or private management information is pushed through
    | Reverb.
    |
    | The public Website receives only an invalidation notification and then
    | retrieves the authoritative gallery from Laravel REST.
    |--------------------------------------------------------------------------
    */

    private function broadcastGalleryUpdate(
        int $galleryImageId,
        string $action
    ): void {
        try {
            WebsiteRealtimeUpdated::dispatch(
                resource: 'gallery_image',
                action: $action,
                entityId: $galleryImageId,
                eventName: 'gallery.updated'
            );
        } catch (
            Throwable $exception
        ) {
            /*
             * Gallery mutation has already completed successfully.
             *
             * A temporary broadcasting problem must not convert the completed
             * management action into a failed API response.
             */
            report(
                $exception
            );
        }
    }
}
