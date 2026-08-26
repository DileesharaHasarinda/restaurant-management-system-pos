<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class InvoiceResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'invoice_number' =>
            $this->invoice_number,

            'invoice_type' =>
            $this->invoice_type,

            'business_day_id' =>
            $this->business_day_id,

            'cashier_shift_id' =>
            $this->cashier_shift_id,

            'order_id' =>
            $this->order_id,

            'table_session_id' =>
            $this->table_session_id,

            'table_name' =>
            $this->table_name_snapshot,

            'customer' => [
                'name' =>
                $this->customer_name,

                'phone' =>
                $this->customer_phone,
            ],

            'items' =>
            $this->whenLoaded(
                'items',
                fn() =>
                $this->items
                    ->map(
                        fn(
                            $item
                        ): array => [
                            'id' =>
                            $item->id,

                            'order_item_id' =>
                            $item->order_item_id,

                            /*
                                 * Historical snapshots.
                                 *
                                 * These values must never be recalculated
                                 * from current menu prices.
                                 */
                            'name' =>
                            $item
                                ->item_name_snapshot,

                            'variant' =>
                            $item
                                ->variant_name_snapshot,

                            'quantity' =>
                            (float)
                            $item->quantity,

                            'unit_price' =>
                            (float)
                            $item->unit_price,

                            'gross_total' =>
                            (float)
                            $item->gross_total,

                            'discount_total' =>
                            (float)
                            $item->discount_total,

                            'tax_total' =>
                            (float)
                            $item->tax_total,

                            'line_total' =>
                            (float)
                            $item->line_total,

                            'addons' =>
                            $item
                                ->addons_snapshot
                                ?? [],
                        ]
                    )
                    ->values()
                    ->all()
            ),

            'totals' => [
                'subtotal' =>
                (float)
                $this->subtotal,

                'discount' =>
                (float)
                $this->discount_total,

                'service_charge' =>
                (float)
                $this->service_charge_total,

                'tax' =>
                (float)
                $this->tax_total,

                'grand_total' =>
                (float)
                $this->grand_total,
            ],

            'payment' => [
                'paid_amount' =>
                (float)
                $this->paid_amount,

                'change_amount' =>
                (float)
                $this->change_amount,

                'balance_due' =>
                (float)
                $this->balance_due,

                'status' =>
                $this->payment_status,
            ],

            'status' =>
            $this->status,

            'issued_by' =>
            $this->issued_by,

            'issued_at' =>
            $this->issued_at
                ?->toISOString(),

            'voided_at' =>
            $this->voided_at
                ?->toISOString(),

            'void_reason' =>
            $this->void_reason,

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }
}
