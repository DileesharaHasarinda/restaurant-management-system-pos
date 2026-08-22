<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PurchaseResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'purchase_number' =>
            $this->purchase_number,

            'supplier' =>
            $this->supplier
                ? (
                    new SupplierResource(
                        $this->supplier
                    )
                )->resolve($request)
                : null,

            'purchase_date' =>
            $this->purchase_date
                ?->format('Y-m-d'),

            'supplier_invoice_number' =>
            $this->supplier_invoice_number,

            'subtotal' =>
            (float) $this->subtotal,

            'grand_total' =>
            (float) $this->grand_total,

            'status' =>
            $this->status,

            'notes' =>
            $this->notes,

            'items' =>
            PurchaseItemResource::collection(
                $this->whenLoaded('items')
            )->resolve($request),

            'completed_at' =>
            $this->completed_at
                ?->toISOString(),

            'created_at' =>
            $this->created_at
                ?->toISOString(),

            'updated_at' =>
            $this->updated_at
                ?->toISOString(),
        ];
    }
}
