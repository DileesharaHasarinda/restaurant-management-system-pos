<?php

namespace App\Http\Requests\Api\V1\Cash;

use Illuminate\Foundation\Http\FormRequest;

class StoreCashDrawerMovementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_request_id' => [
                'required',
                'uuid',
            ],

            'amount' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'reason' => [
                'required',
                'string',
                'max:255',
            ],
        ];
    }
}
