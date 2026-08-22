<?php

namespace App\Http\Requests\Api\V1\Tables;

use Illuminate\Foundation\Http\FormRequest;

class MergeTablesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'secondary_table_id' => [
                'required',
                'integer',
                'exists:tables,id',
            ],

            'reason' => [
                'nullable',
                'string',
                'max:255',
            ],
        ];
    }
}
