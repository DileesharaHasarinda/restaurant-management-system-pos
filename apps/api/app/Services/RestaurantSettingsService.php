<?php

namespace App\Services;

use App\Models\DocumentSequence;
use App\Models\RestaurantSetting;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class RestaurantSettingsService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    /*
    |--------------------------------------------------------------------------
    | Get Restaurant Settings
    |--------------------------------------------------------------------------
    |
    | Restaurant settings contain a single authoritative database row.
    |
    | Do NOT cache the complete Eloquent model instance here.
    |
    | Previously the Eloquent model was stored through Cache::remember().
    | A stale serialized model could later be restored by PHP as:
    |
    | __PHP_Incomplete_Class
    |
    | That breaks this method because it must return:
    |
    | App\Models\RestaurantSetting
    |
    | Reading this single row directly is inexpensive and avoids serialized
    | Eloquent-model cache corruption completely.
    |--------------------------------------------------------------------------
    */

    public function get(): RestaurantSetting
    {
        return RestaurantSetting::query()
            ->firstOrFail();
    }

    /*
    |--------------------------------------------------------------------------
    | Document Numbering
    |--------------------------------------------------------------------------
    */

    public function sequences(): Collection
    {
        return DocumentSequence::query()
            ->orderBy('id')
            ->get();
    }

    /*
    |--------------------------------------------------------------------------
    | Update Restaurant Settings
    |--------------------------------------------------------------------------
    */

    public function update(
        User $actor,
        array $data
    ): RestaurantSetting {
        $numbering =
            $data['numbering'];

        unset(
            $data['numbering']
        );

        return DatabaseTransaction::run(
            function () use (
                $actor,
                $data,
                $numbering
            ): RestaurantSetting {
                $settings =
                    RestaurantSetting::query()
                    ->lockForUpdate()
                    ->firstOrFail();

                $oldValues =
                    $settings->only([
                        'business_name',
                        'legal_name',
                        'phone',
                        'email',
                        'address',
                        'currency',
                        'timezone',
                        'tax_enabled',
                        'default_tax_rate',
                        'service_charge_enabled',
                        'default_service_charge_rate',
                        'receipt_header',
                        'receipt_footer',
                        'opening_hours',
                        'social_media',
                        'website_contact',
                    ]);

                $settings->fill(
                    $data
                );

                $settings->save();

                $this->updateSequences(
                    $numbering
                );

                $this->auditLogger->record(
                    action: 'RESTAURANT_SETTINGS_UPDATED',

                    entityType: 'restaurant_settings',

                    entityId: $settings->id,

                    oldValues: $oldValues,

                    newValues: $settings->only([
                        'business_name',
                        'legal_name',
                        'phone',
                        'email',
                        'address',
                        'currency',
                        'timezone',
                        'tax_enabled',
                        'default_tax_rate',
                        'service_charge_enabled',
                        'default_service_charge_rate',
                        'receipt_header',
                        'receipt_footer',
                        'opening_hours',
                        'social_media',
                        'website_contact',
                    ]),

                    metadata: [
                        'numbering' =>
                        $numbering,
                    ],

                    userId: $actor->id
                );

                return $settings
                    ->refresh();
            }
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Upload Restaurant Logo
    |--------------------------------------------------------------------------
    */

    public function uploadLogo(
        User $actor,
        UploadedFile $logo
    ): RestaurantSetting {
        $newPath =
            $logo->store(
                'restaurant/logos',
                'public'
            );

        try {
            [
                $settings,
                $oldPath,
            ] = DatabaseTransaction::run(
                function () use (
                    $actor,
                    $newPath
                ): array {
                    $settings =
                        RestaurantSetting::query()
                        ->lockForUpdate()
                        ->firstOrFail();

                    $oldPath =
                        $settings
                        ->logo_path;

                    $settings->logo_path =
                        $newPath;

                    $settings->save();

                    $this->auditLogger->record(
                        action: 'RESTAURANT_LOGO_UPDATED',

                        entityType: 'restaurant_settings',

                        entityId: $settings->id,

                        oldValues: [
                            'logo_path' =>
                            $oldPath,
                        ],

                        newValues: [
                            'logo_path' =>
                            $newPath,
                        ],

                        userId: $actor->id
                    );

                    return [
                        $settings
                            ->refresh(),

                        $oldPath,
                    ];
                }
            );
        } catch (
            Throwable $exception
        ) {
            Storage::disk(
                'public'
            )->delete(
                $newPath
            );

            throw $exception;
        }

        if (
            $oldPath
            &&
            $oldPath !== $newPath
        ) {
            Storage::disk(
                'public'
            )->delete(
                $oldPath
            );
        }

        return $settings;
    }

    /*
    |--------------------------------------------------------------------------
    | Remove Restaurant Logo
    |--------------------------------------------------------------------------
    */

    public function removeLogo(
        User $actor
    ): RestaurantSetting {
        [
            $settings,
            $oldPath,
        ] = DatabaseTransaction::run(
            function () use (
                $actor
            ): array {
                $settings =
                    RestaurantSetting::query()
                    ->lockForUpdate()
                    ->firstOrFail();

                $oldPath =
                    $settings
                    ->logo_path;

                $settings->logo_path =
                    null;

                $settings->save();

                $this->auditLogger->record(
                    action: 'RESTAURANT_LOGO_REMOVED',

                    entityType: 'restaurant_settings',

                    entityId: $settings->id,

                    oldValues: [
                        'logo_path' =>
                        $oldPath,
                    ],

                    newValues: [
                        'logo_path' =>
                        null,
                    ],

                    userId: $actor->id
                );

                return [
                    $settings
                        ->refresh(),

                    $oldPath,
                ];
            }
        );

        if (
            $oldPath
        ) {
            Storage::disk(
                'public'
            )->delete(
                $oldPath
            );
        }

        return $settings;
    }

    /*
    |--------------------------------------------------------------------------
    | Update Document Sequences
    |--------------------------------------------------------------------------
    */

    private function updateSequences(
        array $numbering
    ): void {
        $map = [
            'invoice' =>
            DocumentSequence::TYPE_INVOICE,

            'order' =>
            DocumentSequence::TYPE_ORDER,

            'token' =>
            DocumentSequence::TYPE_TOKEN,
        ];

        foreach (
            $map as $key => $type
        ) {
            $sequence =
                DocumentSequence::query()
                ->where(
                    'sequence_type',
                    $type
                )
                ->lockForUpdate()
                ->firstOrFail();

            $sequence->fill([
                'prefix' =>
                $numbering[$key]['prefix'],

                'padding' =>
                $numbering[$key]['padding'],

                'reset_period' =>
                $numbering[$key]['reset_period'],
            ]);

            $sequence->save();
        }
    }
}
