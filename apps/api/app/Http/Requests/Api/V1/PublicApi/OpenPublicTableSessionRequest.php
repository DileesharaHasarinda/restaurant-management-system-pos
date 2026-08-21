<?php

namespace App\Http\Requests\Api\V1\PublicApi;

use Illuminate\Foundation\Http\FormRequest;

class OpenPublicTableSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'guest_count' => [
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],
        ];
    }
}
