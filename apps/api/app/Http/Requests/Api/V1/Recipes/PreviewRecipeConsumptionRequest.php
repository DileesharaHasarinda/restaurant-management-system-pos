<?php

namespace App\Http\Requests\Api\V1\Recipes;

use Illuminate\Foundation\Http\FormRequest;

class PreviewRecipeConsumptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'variant_id' => [
                'nullable',
                'integer',
                'exists:menu_item_variants,id',
            ],

            'item_quantity' => [
                'sometimes',
                'integer',
                'min:1',
                'max:100',
            ],

            'addons' => [
                'sometimes',
                'array',
                'max:30',
            ],

            'addons.*.addon_id' => [
                'required',
                'integer',
                'distinct',
                'exists:addons,id',
            ],

            'addons.*.quantity' => [
                'required',
                'integer',
                'min:1',
                'max:20',
            ],
        ];
    }
}
