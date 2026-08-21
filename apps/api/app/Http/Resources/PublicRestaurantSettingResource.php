<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PublicRestaurantSettingResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'restaurant_name' => $this->business_name,

            'logo_url' => $this->getLogoUrl(),

            'address' => $this->address,

            'phone' => $this->phone,

            'email' => $this->email,

            'currency' => $this->currency,

            'timezone' => $this->timezone,

            'service_charge' => [
                'enabled' => (bool) $this->service_charge_enabled,
                'rate' => (float) $this->default_service_charge_rate,
            ],

            'tax' => [
                'enabled' => (bool) $this->tax_enabled,
                'rate' => (float) $this->default_tax_rate,
            ],

            'opening_hours' => $this->opening_hours ?? [],

            'social_media' => $this->social_media ?? [],

            'website_contact' => $this->website_contact ?? [],
        ];
    }

    private function getLogoUrl(): ?string
    {
        if (! $this->logo_path) {
            return null;
        }

        $path = ltrim(
            (string) $this->logo_path,
            '/'
        );

        return url(
            '/storage/' . $path
        );
    }
}
