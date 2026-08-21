<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class RestaurantSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();

        DB::table(
            'restaurant_settings'
        )->updateOrInsert(
            [
                'id' => 1,
            ],
            [
                'business_name' =>
                'Restaurant',

                'legal_name' =>
                null,

                'phone' =>
                null,

                'email' =>
                null,

                'address' =>
                null,

                'currency' =>
                'LKR',

                'timezone' =>
                'Asia/Colombo',

                'tax_enabled' =>
                false,

                'default_tax_rate' =>
                0,

                'service_charge_enabled' =>
                false,

                'default_service_charge_rate' =>
                0,

                'logo_path' =>
                null,

                'receipt_header' =>
                null,

                'receipt_footer' =>
                'Thank you. Please visit again.',

                'opening_hours' =>
                json_encode([
                    'monday' => [
                        'is_open' => true,
                        'open' => '09:00',
                        'close' => '22:00',
                    ],

                    'tuesday' => [
                        'is_open' => true,
                        'open' => '09:00',
                        'close' => '22:00',
                    ],

                    'wednesday' => [
                        'is_open' => true,
                        'open' => '09:00',
                        'close' => '22:00',
                    ],

                    'thursday' => [
                        'is_open' => true,
                        'open' => '09:00',
                        'close' => '22:00',
                    ],

                    'friday' => [
                        'is_open' => true,
                        'open' => '09:00',
                        'close' => '22:00',
                    ],

                    'saturday' => [
                        'is_open' => true,
                        'open' => '09:00',
                        'close' => '22:00',
                    ],

                    'sunday' => [
                        'is_open' => true,
                        'open' => '09:00',
                        'close' => '22:00',
                    ],
                ]),

                'social_media' =>
                json_encode([
                    'facebook' => null,
                    'instagram' => null,
                    'tiktok' => null,
                    'youtube' => null,
                ]),

                'website_contact' =>
                json_encode([
                    'public_phone' =>
                    null,

                    'public_email' =>
                    null,

                    'whatsapp' =>
                    null,

                    'google_maps_url' =>
                    null,
                ]),

                'settings' =>
                json_encode([
                    'country' =>
                    'LK',

                    'date_format' =>
                    'Y-m-d',

                    'time_format' =>
                    'H:i',
                ]),

                'created_at' =>
                $now,

                'updated_at' =>
                $now,
            ]
        );
    }
}
