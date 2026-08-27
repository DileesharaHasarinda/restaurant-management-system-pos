<?php

namespace App\Http\Requests\Api\V1\Cash;

use Illuminate\Foundation\Http\FormRequest;

final class ManualOpenCashDrawerRequest extends FormRequest
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

            'reason' => [
                'required',
                'string',
                'max:255',
            ],
        ];
    }
}
