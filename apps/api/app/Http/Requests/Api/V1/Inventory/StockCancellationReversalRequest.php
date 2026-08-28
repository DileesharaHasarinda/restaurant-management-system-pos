<?php

namespace App\Http\Requests\Api\V1\Inventory;

use Illuminate\Foundation\Http\FormRequest;

final class StockCancellationReversalRequest extends FormRequest
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

            'quantity' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'reason' => [
                'required',
                'string',
                'min:3',
                'max:1000',
            ],

            'manager_login' => [
                'nullable',
                'string',
                'max:255',
                'required_with:manager_password',
            ],

            'manager_password' => [
                'nullable',
                'string',
                'max:255',
                'required_with:manager_login',
            ],
        ];
    }
}
