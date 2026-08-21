<?php

namespace App\Http\Requests\Api\V1\Tables;

use App\Models\RestaurantTable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTableRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $table =
            $this->route('table');

        $tableId =
            $table instanceof RestaurantTable
            ? $table->id
            : $table;

        return [
            'table_number' => [
                'required',
                'integer',
                'min:1',
                'max:9999',

                Rule::unique(
                    'tables',
                    'table_number'
                )->ignore($tableId),
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

            'is_active' => [
                'required',
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
