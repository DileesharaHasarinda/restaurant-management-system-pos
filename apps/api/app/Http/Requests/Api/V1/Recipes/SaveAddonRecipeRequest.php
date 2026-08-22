<?php

namespace App\Http\Requests\Api\V1\Recipes;

use Illuminate\Foundation\Http\FormRequest;

class SaveAddonRecipeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'components' => [
                'required',
                'array',
                'min:1',
                'max:50',
            ],

            'components.*.ingredient_id' => [
                'required',
                'integer',
                'distinct',
                'exists:ingredients,id',
            ],

            'components.*.quantity' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'components.*.unit_id' => [
                'required',
                'integer',
                'exists:units,id',
            ],
        ];
    }
}
