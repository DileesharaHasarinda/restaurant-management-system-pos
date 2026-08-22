<?php

namespace App\Http\Requests\Api\V1\Takeaway;

use Illuminate\Foundation\Http\FormRequest;

class StoreTakeawayOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_order_id' => [
                'required',
                'uuid',
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

            'pickup_notes' => [
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
