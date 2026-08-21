<?php

namespace App\Services;

use App\Models\DocumentSequence;
use App\Models\RestaurantSetting;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;
use Throwable;

final class RestaurantSettingsService
{
    private const CACHE_KEY =
    'restaurant.settings.current';

    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function get(): RestaurantSetting
    {
        return Cache::remember(
            self::CACHE_KEY,
            now()->addHour(),
            fn(): RestaurantSetting =>
            RestaurantSetting::query()
                ->firstOrFail()
        );
    }

    public function sequences(): Collection
    {
        return DocumentSequence::query()
            ->orderBy('id')
            ->get();
    }

    public function update(
        User $actor,
        array $data
    ): RestaurantSetting {
        $numbering =
            $data['numbering'];

        unset(
            $data['numbering']
        );

        $settings =
            DatabaseTransaction::run(
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

        Cache::forget(
            self::CACHE_KEY
        );

        return $settings;
    }

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
        } catch (Throwable $exception) {
            Storage::disk('public')
                ->delete($newPath);

            throw $exception;
        }

        if (
            $oldPath
            && $oldPath !== $newPath
        ) {
            Storage::disk('public')
                ->delete($oldPath);
        }

        Cache::forget(
            self::CACHE_KEY
        );

        return $settings;
    }

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

        if ($oldPath) {
            Storage::disk('public')
                ->delete(
                    $oldPath
                );
        }

        Cache::forget(
            self::CACHE_KEY
        );

        return $settings;
    }

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
