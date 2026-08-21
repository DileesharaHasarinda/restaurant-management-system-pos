<?php

namespace App\Http\Requests\Api\V1\Tables;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreTableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'table_number' => [
                'required',
                'integer',
                'min:1',
                'max:9999',
                Rule::unique(
                    'tables',
                    'table_number'
                ),
            ],

            'name' => [
                'nullable',
                'string',
                'max:100',
            ],

            'area' => [
                'nullable',
                'string',
                'max:100',
            ],

            'capacity' => [
                'required',
                'integer',
                'min:1',
                'max:100',
            ],

            'qr_ordering_enabled' => [
                'sometimes',
                'boolean',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:1000',
            ],
        ];
    }
}
