<?php

namespace App\Http\Controllers\Api\V1;

use App\Events\WebsiteRealtimeUpdated;
use App\Http\Controllers\Controller;
use App\Models\GalleryImage;
use App\Models\User;
use App\Services\AuditLogger;
use App\Support\ApiResponse;
use App\Support\DatabaseTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class GalleryImageDeletionController extends Controller
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function destroy(
        Request $request,
        GalleryImage $galleryImage
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        [
            $imageId,
            $imagePath,
        ] = DatabaseTransaction::run(
            function () use (
                $galleryImage,
                $user
            ): array {
                /** @var GalleryImage $locked */
                $locked =
                    GalleryImage::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $galleryImage->id
                    );

                $imageId =
                    (int)
                    $locked->id;

                $imagePath =
                    $locked->image_path;

                $oldValues = [
                    'title' =>
                    $locked->title,

                    'image_path' =>
                    $locked->image_path,

                    'alt_text' =>
                    $locked->alt_text,

                    'sort_order' =>
                    (int)
                    $locked->sort_order,

                    'is_active' =>
                    (bool)
                    $locked->is_active,

                    'uploaded_by' =>
                    $locked->uploaded_by,
                ];

                /*
                |--------------------------------------------------------------------------
                | Delete Database Record
                |--------------------------------------------------------------------------
                */

                $locked->delete();

                /*
                |--------------------------------------------------------------------------
                | Audit
                |--------------------------------------------------------------------------
                */

                $this->auditLogger->record(
                    action: 'GALLERY_IMAGE_DELETED',

                    entityType: 'gallery_image',

                    entityId: $imageId,

                    oldValues: $oldValues,

                    newValues: [],

                    metadata: [
                        'image_path' =>
                        $imagePath,
                    ],

                    userId: $user->id
                );

                return [
                    $imageId,
                    $imagePath,
                ];
            }
        );

        /*
        |--------------------------------------------------------------------------
        | Permanently Delete Stored File
        |--------------------------------------------------------------------------
        |
        | Database deletion happens first inside the transaction. The physical
        | file is then removed from Laravel's public storage disk.
        |--------------------------------------------------------------------------
        */

        if (
            filled(
                $imagePath
            )
        ) {
            Storage::disk(
                'public'
            )->delete(
                $imagePath
            );
        }

        /*
        |--------------------------------------------------------------------------
        | Realtime Invalidation
        |--------------------------------------------------------------------------
        |
        | Realtime remains only an invalidation signal. Public/operations
        | clients will re-fetch authoritative gallery data from Laravel.
        |--------------------------------------------------------------------------
        */

        try {
            WebsiteRealtimeUpdated::dispatch(
                resource: 'gallery_image',

                action: 'GALLERY_IMAGE_DELETED',

                entityId: $imageId,

                eventName: 'gallery.updated'
            );
        } catch (
            Throwable $exception
        ) {
            /*
             * The database deletion is already committed.
             * A realtime transport problem must not turn the successful
             * deletion into a false HTTP failure.
             */
            report(
                $exception
            );
        }

        return ApiResponse::success(
            data: null,

            message: 'Gallery image deleted permanently.'
        );
    }
}
