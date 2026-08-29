<?php

namespace App\Http\Controllers\Api\V1;

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

class GalleryManagementController extends Controller
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

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

    public function store(
        StoreGalleryImageRequest $request
    ): JsonResponse {
        /** @var User $actor */
        $actor =
            $request->user();

        $path =
            $request
            ->file('image')
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
        } catch (\Throwable $exception) {
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

        $this->auditLogger->record(
            action: $galleryImage->is_active
                ? 'GALLERY_IMAGE_ENABLED'
                : 'GALLERY_IMAGE_DISABLED',

            entityType: 'gallery_image',

            entityId: $galleryImage->id,

            metadata: [
                'is_active' =>
                $galleryImage->is_active,
            ],

            userId: $actor->id
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
}
