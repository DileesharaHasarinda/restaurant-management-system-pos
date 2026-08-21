<?php

namespace App\Http\Requests\Api\V1\Tables;

use Illuminate\Foundation\Http\FormRequest;

class UpdateQrOrderingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'enabled' => [
                'required',
                'boolean',
            ],
        ];
    }
}
