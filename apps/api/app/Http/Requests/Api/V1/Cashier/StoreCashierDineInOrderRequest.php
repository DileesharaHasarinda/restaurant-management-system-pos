<?php

namespace App\Http\Requests\Api\V1\Cashier;

use Illuminate\Foundation\Http\FormRequest;

final class StoreCashierDineInOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'customer_name' =>
            filled(
                $this->input(
                    'customer_name'
                )
            )
                ? trim(
                    (string)
                    $this->input(
                        'customer_name'
                    )
                )
                : null,

            'customer_phone' =>
            filled(
                $this->input(
                    'customer_phone'
                )
            )
                ? trim(
                    (string)
                    $this->input(
                        'customer_phone'
                    )
                )
                : null,

            'notes' =>
            filled(
                $this->input(
                    'notes'
                )
            )
                ? trim(
                    (string)
                    $this->input(
                        'notes'
                    )
                )
                : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'client_order_id' => [
                'required',
                'uuid',
            ],

            'guest_count' => [
                'required',
                'integer',
                'min:1',
                'max:100',
            ],

            'customer_name' => [
                'nullable',
                'string',
                'max:150',
            ],

            'customer_phone' => [
                'nullable',
                'string',
                'max:50',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'items' => [
                'required',
                'array',
                'min:1',
                'max:100',
            ],

            'items.*.menu_item_id' => [
                'required',
                'integer',
                'exists:menu_items,id',
            ],

            'items.*.variant_id' => [
                'nullable',
                'integer',
                'exists:menu_item_variants,id',
            ],

            'items.*.quantity' => [
                'required',
                'integer',
                'min:1',
                'max:99',
            ],

            'items.*.notes' => [
                'nullable',
                'string',
                'max:1000',
            ],

            'items.*.addons' => [
                'nullable',
                'array',
                'max:50',
            ],

            'items.*.addons.*.addon_id' => [
                'required',
                'integer',
                'exists:addons,id',
            ],

            'items.*.addons.*.quantity' => [
                'required',
                'integer',
                'min:1',
                'max:99',
            ],
        ];
    }
}
