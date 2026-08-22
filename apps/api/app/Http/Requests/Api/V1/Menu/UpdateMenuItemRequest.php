<?php

namespace App\Http\Requests\Api\V1\Menu;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMenuItemRequest extends FormRequest
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

            'sort_order' => [
                'required',
                'integer',
                'min:0',
            ],

            'variants' => [
                'present',
                'array',
                'max:20',
            ],

            'variants.*.id' => [
                'nullable',
                'integer',
                'exists:menu_item_variants,id',
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
                'required',
                'boolean',
            ],

            'variants.*.is_available' => [
                'required',
                'boolean',
            ],

            'variants.*.is_active' => [
                'required',
                'boolean',
            ],

            'variants.*.sort_order' => [
                'required',
                'integer',
                'min:0',
            ],

            'addons' => [
                'present',
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
                'required',
                'boolean',
            ],

            'addons.*.sort_order' => [
                'required',
                'integer',
                'min:0',
            ],
        ];
    }
}
