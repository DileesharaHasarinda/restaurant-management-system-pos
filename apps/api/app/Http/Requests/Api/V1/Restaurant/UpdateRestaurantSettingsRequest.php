<?php

namespace App\Http\Requests\Api\V1\Restaurant;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateRestaurantSettingsRequest extends FormRequest
{
    private const DAYS = [
        'monday',
        'tuesday',
        'wednesday',
        'thursday',
        'friday',
        'saturday',
        'sunday',
    ];

    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $numbering =
            $this->input(
                'numbering',
                []
            );

        foreach (
            [
                'invoice',
                'order',
                'token',
            ] as $type
        ) {
            if (
                isset(
                    $numbering[$type]
                )
            ) {
                $numbering[$type]['prefix'] =
                    Str::upper(
                        trim(
                            (string)
                            (
                                $numbering[$type]['prefix']
                                ?? ''
                            )
                        )
                    );

                $numbering[$type]['reset_period'] =
                    Str::upper(
                        trim(
                            (string)
                            (
                                $numbering[$type]['reset_period']
                                ?? ''
                            )
                        )
                    );
            }
        }

        $this->merge([
            'business_name' =>
            trim(
                (string)
                $this->input(
                    'business_name'
                )
            ),

            'email' =>
            filled(
                $this->input(
                    'email'
                )
            )
                ? Str::lower(
                    trim(
                        (string)
                        $this->input(
                            'email'
                        )
                    )
                )
                : null,

            'currency' =>
            Str::upper(
                trim(
                    (string)
                    $this->input(
                        'currency'
                    )
                )
            ),

            'timezone' =>
            trim(
                (string)
                $this->input(
                    'timezone'
                )
            ),

            'numbering' =>
            $numbering,
        ]);
    }

    public function rules(): array
    {
        return [
            'business_name' => [
                'required',
                'string',
                'max:190',
            ],

            'legal_name' => [
                'nullable',
                'string',
                'max:190',
            ],

            'address' => [
                'nullable',
                'string',
                'max:1000',
            ],

            'phone' => [
                'nullable',
                'string',
                'max:50',
            ],

            'email' => [
                'nullable',
                'email:rfc',
                'max:190',
            ],

            'currency' => [
                'required',
                'string',
                'size:3',
                'regex:/^[A-Z]{3}$/',
            ],

            'timezone' => [
                'required',
                'timezone',
            ],

            'service_charge_enabled' => [
                'required',
                'boolean',
            ],

            'default_service_charge_rate' => [
                'required',
                'numeric',
                'min:0',
                'max:100',
            ],

            'tax_enabled' => [
                'required',
                'boolean',
            ],

            'default_tax_rate' => [
                'required',
                'numeric',
                'min:0',
                'max:100',
            ],

            'receipt_header' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'receipt_footer' => [
                'nullable',
                'string',
                'max:3000',
            ],

            'opening_hours' => [
                'required',
                'array',
                'required_array_keys:' .
                    implode(
                        ',',
                        self::DAYS
                    ),
            ],

            'opening_hours.*' => [
                'required',
                'array',
            ],

            'opening_hours.*.is_open' => [
                'required',
                'boolean',
            ],

            'opening_hours.*.open' => [
                'nullable',
                'date_format:H:i',
            ],

            'opening_hours.*.close' => [
                'nullable',
                'date_format:H:i',
            ],

            'social_media' => [
                'required',
                'array',
            ],

            'social_media.facebook' => [
                'nullable',
                'url',
                'max:500',
            ],

            'social_media.instagram' => [
                'nullable',
                'url',
                'max:500',
            ],

            'social_media.tiktok' => [
                'nullable',
                'url',
                'max:500',
            ],

            'social_media.youtube' => [
                'nullable',
                'url',
                'max:500',
            ],

            'website_contact' => [
                'required',
                'array',
            ],

            'website_contact.public_phone' => [
                'nullable',
                'string',
                'max:50',
            ],

            'website_contact.public_email' => [
                'nullable',
                'email:rfc',
                'max:190',
            ],

            'website_contact.whatsapp' => [
                'nullable',
                'string',
                'max:50',
            ],

            'website_contact.google_maps_url' => [
                'nullable',
                'url',
                'max:1000',
            ],

            'numbering' => [
                'required',
                'array',
            ],

            'numbering.invoice' => [
                'required',
                'array',
            ],

            'numbering.order' => [
                'required',
                'array',
            ],

            'numbering.token' => [
                'required',
                'array',
            ],

            'numbering.*.prefix' => [
                'required',
                'string',
                'min:1',
                'max:20',
                'regex:/^[A-Z0-9_-]+$/',
            ],

            'numbering.*.padding' => [
                'required',
                'integer',
                'min:3',
                'max:10',
            ],

            'numbering.*.reset_period' => [
                'required',
                Rule::in([
                    'NEVER',
                    'DAILY',
                    'MONTHLY',
                    'YEARLY',
                ]),
            ],
        ];
    }

    public function withValidator(
        Validator $validator
    ): void {
        $validator->after(
            function (
                Validator $validator
            ): void {
                $openingHours =
                    $this->input(
                        'opening_hours',
                        []
                    );

                foreach (
                    self::DAYS
                    as $day
                ) {
                    $schedule =
                        $openingHours[$day] ?? [];

                    if (
                        ($schedule['is_open'] ?? false)
                    ) {
                        if (
                            empty($schedule['open'] ?? null)
                        ) {
                            $validator
                                ->errors()
                                ->add(
                                    "opening_hours.{$day}.open",
                                    "Opening time is required for {$day}."
                                );
                        }

                        if (
                            empty($schedule['close'] ?? null)
                        ) {
                            $validator
                                ->errors()
                                ->add(
                                    "opening_hours.{$day}.close",
                                    "Closing time is required for {$day}."
                                );
                        }
                    }
                }
            }
        );
    }
}
