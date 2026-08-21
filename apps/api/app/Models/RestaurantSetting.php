<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RestaurantSetting extends Model
{
    protected $fillable = [
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
        'logo_path',
        'receipt_header',
        'receipt_footer',
        'opening_hours',
        'social_media',
        'website_contact',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'tax_enabled' =>
            'boolean',

            'default_tax_rate' =>
            'decimal:4',

            'service_charge_enabled' =>
            'boolean',

            'default_service_charge_rate' =>
            'decimal:4',

            'opening_hours' =>
            'array',

            'social_media' =>
            'array',

            'website_contact' =>
            'array',

            'settings' =>
            'array',
        ];
    }
}
