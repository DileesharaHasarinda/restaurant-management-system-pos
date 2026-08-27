<?php

namespace App\Http\Requests\Api\V1\Cash;

use Illuminate\Foundation\Http\FormRequest;

class OpenCashierShiftRequest extends FormRequest
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

            'opening_cash' => [
                'required',
                'numeric',
                'min:0',
            ],

            'opening_notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ];
    }
}
