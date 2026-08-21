<?php

namespace App\Http\Requests\Api\V1\Users;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListUsersRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => [
                'nullable',
                'string',
                'max:190',
            ],

            'role' => [
                'nullable',
                'string',
                Rule::in([
                    'OWNER',
                    'ADMIN',
                    'MANAGER',
                    'CASHIER',
                    'WAITER',
                ]),
            ],

            'status' => [
                'nullable',
                'string',
                Rule::in([
                    'ACTIVE',
                    'INACTIVE',
                ]),
            ],

            'per_page' => [
                'nullable',
                'integer',
                'min:1',
                'max:100',
            ],
        ];
    }
}
