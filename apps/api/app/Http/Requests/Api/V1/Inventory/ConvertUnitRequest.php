<?php

namespace App\Http\Requests\Api\V1\Inventory;

use Illuminate\Foundation\Http\FormRequest;

class ConvertUnitRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'quantity' => [
                'required',
                'numeric',
                'min:0',
            ],

            'from_unit_id' => [
                'required',
                'integer',
                'exists:units,id',
            ],

            'to_unit_id' => [
                'required',
                'integer',
                'exists:units,id',
            ],
        ];
    }
}
