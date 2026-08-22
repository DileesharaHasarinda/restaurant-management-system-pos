<?php

namespace App\Http\Requests\Api\V1\Menu;

use Illuminate\Foundation\Http\FormRequest;

class StoreMenuItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'category_id' => [
                'required',
                'integer',
                'exists:categories,id',
            ],

            'name' => [
                'required',
                'string',
                'max:190',
            ],

            'description' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'price' => [
                'required',
                'numeric',
                'min:0',
            ],

            'tax_rate' => [
                'nullable',
                'numeric',
                'min:0',
                'max:100',
            ],

            'is_available' => [
                'sometimes',
                'boolean',
            ],

            'is_active' => [
                'sometimes',
                'boolean',
            ],

            'is_visible_on_website' => [
                'sometimes',
                'boolean',
            ],

            'is_visible_on_qr' => [
                'sometimes',
                'boolean',
            ],

            'sort_order' => [
                'nullable',
                'integer',
                'min:0',
            ],

            /*
             * Variants
             */
            'variants' => [
                'nullable',
                'array',
                'max:20',
            ],

            'variants.*.name' => [
                'required',
                'string',
                'max:100',
            ],

            'variants.*.price' => [
                'required',
                'numeric',
                'min:0',
            ],

            'variants.*.is_default' => [
                'sometimes',
                'boolean',
            ],

            'variants.*.is_available' => [
                'sometimes',
                'boolean',
            ],

            'variants.*.is_active' => [
                'sometimes',
                'boolean',
            ],

            'variants.*.sort_order' => [
                'nullable',
                'integer',
                'min:0',
            ],

            /*
             * Add-ons attached to this item.
             */
            'addons' => [
                'nullable',
                'array',
                'max:50',
            ],

            'addons.*.addon_id' => [
                'required',
                'integer',
                'exists:addons,id',
            ],

            'addons.*.price_override' => [
                'nullable',
                'numeric',
                'min:0',
            ],

            'addons.*.is_default' => [
                'sometimes',
                'boolean',
            ],

            'addons.*.sort_order' => [
                'nullable',
                'integer',
                'min:0',
            ],
        ];
    }
}
