<?php

namespace App\Http\Requests\Api\V1\Tables;

use Illuminate\Foundation\Http\FormRequest;

class OpenTableSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'guest_count' => [
                'required',
                'integer',
                'min:1',
                'max:100',
            ],
        ];
    }
}
