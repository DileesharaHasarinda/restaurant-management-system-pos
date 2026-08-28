<?php

namespace App\Http\Requests\Api\V1\Orders;

use Illuminate\Foundation\Http\FormRequest;

class CancelOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (
            $this->has(
                'reason'
            )
        ) {
            $this->merge([
                'reason' =>
                trim(
                    (string)
                    $this->input(
                        'reason'
                    )
                ),
            ]);
        }

        if (
            $this->has(
                'manager_login'
            )
        ) {
            $this->merge([
                'manager_login' =>
                trim(
                    (string)
                    $this->input(
                        'manager_login'
                    )
                ),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'reason' => [
                'required',
                'string',
                'min:3',
                'max:1000',
            ],

            /*
             * Service decides whether credentials are mandatory
             * based on the locked order status.
             */
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
