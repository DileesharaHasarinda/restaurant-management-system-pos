<?php

namespace App\Http\Requests\Api\V1\Expenses;

use App\Models\Expense;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateExpenseRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
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

            'description' =>
            trim(
                (string)
                $this->input(
                    'description'
                )
            ),

            'notes' =>
            filled(
                $this->input(
                    'notes'
                )
            )
                ? trim(
                    (string)
                    $this->input(
                        'notes'
                    )
                )
                : null,

            'reference_number' =>
            filled(
                $this->input(
                    'reference_number'
                )
            )
                ? trim(
                    (string)
                    $this->input(
                        'reference_number'
                    )
                )
                : null,
        ]);
    }

    public function rules(): array
    {
        return [
            'expense_category_id' => [
                'required',
                'integer',
                'exists:expense_categories,id',
            ],

            'expense_date' => [
                'required',
                'date',
                'before_or_equal:today',
            ],

            'description' => [
                'required',
                'string',
                'max:255',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'amount' => [
                'required',
                'numeric',
                'gt:0',
                'decimal:0,2',
            ],

            'payment_method' => [
                'required',
                Rule::in(
                    Expense::paymentMethods()
                ),
            ],

            'reference_number' => [
                'nullable',
                'string',
                'max:150',
            ],

            'cashier_shift_id' => [
                'sometimes',
                'nullable',
                'integer',
                'exists:cashier_shifts,id',
            ],
        ];
    }

    public function after(): array
    {
        return [
            function (
                Validator $validator
            ): void {
                if (
                    $this->input(
                        'payment_method'
                    )
                    ===
                    Expense::METHOD_CHEQUE
                    &&
                    blank(
                        $this->input(
                            'reference_number'
                        )
                    )
                ) {
                    $validator
                        ->errors()
                        ->add(
                            'reference_number',
                            'A cheque number/reference is required for cheque expenses.'
                        );
                }
            },
        ];
    }
}
