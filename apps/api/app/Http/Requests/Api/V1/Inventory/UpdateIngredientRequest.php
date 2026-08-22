<?php

namespace App\Http\Requests\Api\V1\Inventory;

use App\Models\Ingredient;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateIngredientRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'name' =>
            trim(
                (string)
                $this->input('name')
            ),

            'storage_location' =>
            filled(
                $this->input(
                    'storage_location'
                )
            )
                ? trim(
                    (string)
                    $this->input(
                        'storage_location'
                    )
                )
                : null,
        ]);
    }

    public function rules(): array
    {
        $ingredient =
            $this->route(
                'ingredient'
            );

        $ingredientId =
            $ingredient instanceof Ingredient
            ? $ingredient->id
            : $ingredient;

        return [
            'name' => [
                'required',
                'string',
                'max:190',

                Rule::unique(
                    'ingredients',
                    'name'
                )->ignore(
                    $ingredientId
                ),
            ],

            'base_unit_id' => [
                'required',
                'integer',
                'exists:units,id',
            ],

            'minimum_stock' => [
                'required',
                'numeric',
                'min:0',
            ],

            'storage_location' => [
                'nullable',
                'string',
                'max:190',
            ],
        ];
    }
}
