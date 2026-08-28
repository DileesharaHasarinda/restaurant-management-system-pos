<?php

namespace App\Http\Requests\Api\V1\Refunds;

use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class CreateRefundRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (
            [
                'reason',
                'manager_login',
            ]
            as $field
        ) {
            if (
                $this->has(
                    $field
                )
            ) {
                $this->merge([
                    $field =>
                    trim(
                        (string)
                        $this->input(
                            $field
                        )
                    ),
                ]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'client_request_id' => [
                'required',
                'uuid',
            ],

            'payment_id' => [
                'nullable',
                'integer',
                'exists:payments,id',
            ],

            'cashier_shift_id' => [
                'nullable',
                'integer',
                'exists:cashier_shifts,id',
            ],

            'amount' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'refund_method' => [
                'required',
                'string',
                Rule::in(
                    Payment::METHODS
                ),
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
