<?php

namespace App\Http\Requests\Api\V1\Inventory;

use App\Models\Unit;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class UpdateUnitRequest extends FormRequest
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

            'symbol' =>
            Str::upper(
                trim(
                    (string)
                    $this->input('symbol')
                )
            ),

            'measurement_type' =>
            Str::upper(
                trim(
                    (string)
                    $this->input(
                        'measurement_type'
                    )
                )
            ),
        ]);
    }

    public function rules(): array
    {
        $unit =
            $this->route('unit');

        $unitId =
            $unit instanceof Unit
            ? $unit->id
            : $unit;

        return [
            'name' => [
                'required',
                'string',
                'max:100',

                Rule::unique(
                    'units',
                    'name'
                )->ignore(
                    $unitId
                ),
            ],

            'symbol' => [
                'required',
                'string',
                'max:20',
                'regex:/^[A-Z0-9_-]+$/',

                Rule::unique(
                    'units',
                    'symbol'
                )->ignore(
                    $unitId
                ),
            ],

            'measurement_type' => [
                'required',

                Rule::in([
                    Unit::TYPE_MASS,
                    Unit::TYPE_VOLUME,
                    Unit::TYPE_COUNT,
                ]),
            ],

            'base_unit_id' => [
                'nullable',
                'integer',
                'exists:units,id',
            ],

            'conversion_factor' => [
                'required',
                'numeric',
                'gt:0',
            ],
        ];
    }
}
