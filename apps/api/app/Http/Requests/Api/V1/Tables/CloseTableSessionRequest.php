<?php

namespace App\Http\Requests\Api\V1\Tables;

use Illuminate\Foundation\Http\FormRequest;

class CloseTableSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'reason' => [
                'nullable',
                'string',
                'max:255',
            ],
        ];
    }
}
