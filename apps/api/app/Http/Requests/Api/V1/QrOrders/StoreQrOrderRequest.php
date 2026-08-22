<?php

namespace App\Http\Requests\Api\V1\QrOrders;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreQrOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        /*
         * Public customer endpoint.
         *
         * No customer login is required.
         */
        return true;
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'customer_name' =>
            filled(
                $this->input(
                    'customer_name'
                )
            )
                ? trim(
                    (string)
                    $this->input(
                        'customer_name'
                    )
                )
                : null,

            'customer_phone' =>
            filled(
                $this->input(
                    'customer_phone'
                )
            )
                ? trim(
                    (string)
                    $this->input(
                        'customer_phone'
                    )
                )
                : null,

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
        ]);
    }

    public function rules(): array
    {
        return [
            /*
             * Generate once when Place Order
             * is clicked.
             *
             * Reuse the SAME UUID if the
             * request has to be retried.
             */
            'client_order_id' => [
                'required',
                'uuid',
                'max:64',
            ],

            'customer_name' => [
                'nullable',
                'string',
                'max:150',
            ],

            'customer_phone' => [
                'nullable',
                'string',
                'max:50',
            ],

            'notes' => [
                'nullable',
                'string',
                'max:2000',
            ],

            'items' => [
                'required',
                'array',
                'min:1',
                'max:50',
            ],

            'items.*.menu_item_id' => [
                'required',
                'integer',
                'exists:menu_items,id',
            ],

            'items.*.variant_id' => [
                'nullable',
                'integer',
                'exists:menu_item_variants,id',
            ],

            'items.*.quantity' => [
                'required',
                'integer',
                'min:1',
                'max:20',
            ],

            'items.*.special_notes' => [
                'nullable',
                'string',
                'max:1000',
            ],

            'items.*.addons' => [
                'sometimes',
                'array',
                'max:20',
            ],

            'items.*.addons.*.addon_id' => [
                'required',
                'integer',
                'exists:addons,id',
            ],

            /*
             * Quantity PER menu item.
             *
             * Example:
             * Extra Egg x2 on one Fried Rice.
             */
            'items.*.addons.*.quantity' => [
                'required',
                'integer',
                'min:1',
                'max:10',
            ],
        ];
    }

    public function after(): array
    {
        return [
            function (
                Validator $validator
            ): void {
                $items =
                    $this->input(
                        'items',
                        []
                    );

                foreach (
                    $items as $itemIndex => $item
                ) {
                    $addonIds =
                        collect(
                            $item['addons']
                                ?? []
                        )
                        ->pluck(
                            'addon_id'
                        )
                        ->filter(
                            fn($value) =>
                            $value !== null
                        )
                        ->map(
                            fn($value) =>
                            (int) $value
                        )
                        ->all();

                    if (
                        count(
                            $addonIds
                        )
                        !== count(
                            array_unique(
                                $addonIds
                            )
                        )
                    ) {
                        $validator
                            ->errors()
                            ->add(
                                "items.{$itemIndex}.addons",
                                'The same add-on cannot be added twice to one cart item. Increase its quantity instead.'
                            );
                    }
                }
            },
        ];
    }
}
