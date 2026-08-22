<?php

namespace App\Http\Requests\Api\V1\Waiter;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreWaiterOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'client_order_id' => [
                'required',
                'uuid',
                'max:64',
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
                    $items as $index => $item
                ) {
                    $addonIds =
                        collect(
                            $item['addons']
                                ?? []
                        )
                        ->pluck(
                            'addon_id'
                        )
                        ->map(
                            fn($value) =>
                            (int) $value
                        )
                        ->all();

                    if (
                        count($addonIds)
                        !== count(
                            array_unique(
                                $addonIds
                            )
                        )
                    ) {
                        $validator
                            ->errors()
                            ->add(
                                "items.{$index}.addons",
                                'The same add-on cannot be selected twice. Increase its quantity instead.'
                            );
                    }
                }
            },
        ];
    }
}
