<?php

namespace App\Http\Requests\Api\V1\Expenses;

use App\Models\Expense;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListExpensesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if (
            filled(
                $this->input(
                    'payment_method'
                )
            )
        ) {
            $this->merge([
                'payment_method' =>
                strtoupper(
                    trim(
                        (string)
                        $this->input(
                            'payment_method'
                        )
                    )
                ),
            ]);
        }

        if (
            filled(
                $this->input(
                    'status'
                )
            )
        ) {
            $this->merge([
                'status' =>
                strtoupper(
                    trim(
                        (string)
                        $this->input(
                            'status'
                        )
                    )
                ),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'expense_category_id' => [
                'nullable',
                'integer',
                'exists:expense_categories,id',
            ],

            'payment_method' => [
                'nullable',
                Rule::in(
                    Expense::paymentMethods()
                ),
            ],

            'status' => [
                'nullable',
                Rule::in([
                    Expense::STATUS_POSTED,
                    Expense::STATUS_VOID,
                ]),
            ],

            'date_from' => [
                'nullable',
                'date',
            ],

            'date_to' => [
                'nullable',
                'date',
                'after_or_equal:date_from',
            ],

            'search' => [
                'nullable',
                'string',
                'max:150',
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
