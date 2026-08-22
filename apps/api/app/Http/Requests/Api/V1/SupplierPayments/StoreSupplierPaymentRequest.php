<?php

namespace App\Http\Requests\Api\V1\SupplierPayments;

use App\Models\SupplierPayment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreSupplierPaymentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $payments =
            collect(
                $this->input(
                    'payments',
                    []
                )
            )
            ->map(
                function ($payment): array {
                    if (! is_array($payment)) {
                        return [];
                    }

                    $payment['payment_method'] =
                        strtoupper(
                            trim(
                                (string)
                                (
                                    $payment['payment_method']
                                    ?? ''
                                )
                            )
                        );

                    if (
                        array_key_exists(
                            'reference',
                            $payment
                        )
                    ) {
                        $payment['reference'] =
                            filled(
                                $payment['reference']
                            )
                            ? trim(
                                (string)
                                $payment['reference']
                            )
                            : null;
                    }

                    return $payment;
                }
            )
            ->all();

        $this->merge([
            'payments' =>
            $payments,

            'notes' =>
            filled(
                $this->input('notes')
            )
                ? trim(
                    (string)
                    $this->input('notes')
                )
                : null,
        ]);
    }

    public function rules(): array
    {
        return [
            /*
             * Generate once on the frontend for
             * every Pay button submission.
             */
            'idempotency_key' => [
                'required',
                'uuid',
                'max:64',
            ],

            'payment_date' => [
                'required',
                'date',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'payments' => [
                'required',
                'array',
                'min:1',
                'max:10',
            ],

            'payments.*.payment_method' => [
                'required',

                Rule::in(
                    SupplierPayment::methods()
                ),
            ],

            'payments.*.amount' => [
                'required',
                'numeric',
                'gt:0',
                'decimal:0,2',
            ],

            'payments.*.reference' => [
                'nullable',
                'string',
                'max:190',
            ],

            'payments.*.notes' => [
                'nullable',
                'string',
                'max:500',
            ],
        ];
    }

    public function after(): array
    {
        return [
            function (
                Validator $validator
            ): void {
                $payments =
                    $this->input(
                        'payments',
                        []
                    );

                foreach (
                    $payments as $index => $payment
                ) {
                    $method =
                        $payment['payment_method']
                        ?? null;

                    $reference =
                        trim(
                            (string)
                            (
                                $payment['reference']
                                ?? ''
                            )
                        );

                    /*
                     * A cheque payment must have
                     * its cheque/reference number.
                     */
                    if (
                        $method
                        === SupplierPayment::METHOD_CHEQUE
                        && $reference === ''
                    ) {
                        $validator
                            ->errors()
                            ->add(
                                "payments.{$index}.reference",
                                'A cheque number/reference is required for cheque payments.'
                            );
                    }
                }
            },
        ];
    }
}
