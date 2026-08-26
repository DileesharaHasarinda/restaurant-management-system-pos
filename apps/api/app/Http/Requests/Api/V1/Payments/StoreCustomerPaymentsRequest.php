<?php

namespace App\Http\Requests\Api\V1\Payments;

use App\Models\Payment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreCustomerPaymentsRequest extends FormRequest
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

            'cashier_shift_id' => [
                'nullable',
                'integer',
                'exists:cashier_shifts,id',
            ],

            'payments' => [
                'required',
                'array',
                'min:1',
                'max:10',
            ],

            'payments.*.payment_method' => [
                'required',
                'string',
                Rule::in(
                    Payment::METHODS
                ),
            ],

            'payments.*.amount' => [
                'required',
                'numeric',
                'gt:0',
            ],

            'payments.*.tendered_amount' => [
                'nullable',
                'numeric',
                'gt:0',
            ],

            'payments.*.reference_number' => [
                'nullable',
                'string',
                'max:150',
            ],

            'payments.*.notes' => [
                'nullable',
                'string',
                'max:2000',
            ],
        ];
    }
}
