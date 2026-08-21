<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Api\V1\Restaurant\UpdateRestaurantSettingsRequest;
use App\Http\Requests\Api\V1\Restaurant\UploadRestaurantLogoRequest;
use App\Http\Resources\DocumentSequenceResource;
use App\Http\Resources\PublicRestaurantSettingResource;
use App\Http\Resources\RestaurantSettingResource;
use App\Models\User;
use App\Services\RestaurantSettingsService;
use App\Support\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class RestaurantSettingsController extends Controller
{
    public function __construct(
        private readonly RestaurantSettingsService $settingsService
    ) {}

    public function publicShow(
        Request $request
    ): JsonResponse {
        $settings =
            $this
            ->settingsService
            ->get();

        return ApiResponse::success(
            data: (
                new PublicRestaurantSettingResource(
                    $settings
                )
            )->resolve(
                $request
            ),

            message: 'Restaurant information retrieved successfully.'
        );
    }

    public function show(
        Request $request
    ): JsonResponse {
        $settings =
            $this
            ->settingsService
            ->get();

        $sequences =
            $this
            ->settingsService
            ->sequences();

        return ApiResponse::success(
            data: [
                'settings' => (
                    new RestaurantSettingResource(
                        $settings
                    )
                )->resolve(
                    $request
                ),

                'numbering' =>
                DocumentSequenceResource::collection(
                    $sequences
                )->resolve(
                    $request
                ),
            ],

            message: 'Restaurant settings retrieved successfully.'
        );
    }

    public function update(
        UpdateRestaurantSettingsRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $settings =
            $this
            ->settingsService
            ->update(
                $user,
                $request
                    ->validated()
            );

        $sequences =
            $this
            ->settingsService
            ->sequences();

        return ApiResponse::success(
            data: [
                'settings' => (
                    new RestaurantSettingResource(
                        $settings
                    )
                )->resolve(
                    $request
                ),

                'numbering' =>
                DocumentSequenceResource::collection(
                    $sequences
                )->resolve(
                    $request
                ),
            ],

            message: 'Restaurant settings updated successfully.'
        );
    }

    public function uploadLogo(
        UploadRestaurantLogoRequest $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $settings =
            $this
            ->settingsService
            ->uploadLogo(
                $user,
                $request->file(
                    'logo'
                )
            );

        return ApiResponse::success(
            data: (
                new RestaurantSettingResource(
                    $settings
                )
            )->resolve(
                $request
            ),

            message: 'Restaurant logo updated successfully.'
        );
    }

    public function removeLogo(
        Request $request
    ): JsonResponse {
        /** @var User $user */
        $user =
            $request->user();

        $settings =
            $this
            ->settingsService
            ->removeLogo(
                $user
            );

        return ApiResponse::success(
            data: (
                new RestaurantSettingResource(
                    $settings
                )
            )->resolve(
                $request
            ),

            message: 'Restaurant logo removed successfully.'
        );
    }
}
