<?php

namespace App\Http\Resources;

use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Expense
 */
class ExpenseResource extends JsonResource
{
    public function toArray(
        Request $request
    ): array {
        return [
            'id' =>
            $this->id,

            'client_request_id' =>
            $this->client_request_id,

            'expense_number' =>
            $this->expense_number,

            'expense_date' =>
            $this
                ->expense_date
                ?->toDateString(),

            'category' =>
            $this->category
                ? [
                    'id' =>
                    $this->category->id,

                    'name' =>
                    $this->category->name,

                    'code' =>
                    $this->category->code,
                ]
                : null,

            'description' =>
            $this->description,

            'notes' =>
            $this->notes,

            'amount' =>
            (float)
            $this->amount,

            'payment_method' =>
            $this->payment_method,

            'payment_method_label' =>
            Expense::paymentMethodLabels()[$this->payment_method]
                ?? $this->payment_method,

            'reference_number' =>
            $this->reference_number,

            'status' =>
            $this->status,

            'business_day' =>
            $this->businessDay
                ? [
                    'id' =>
                    $this
                        ->businessDay
                        ->id,

                    'business_date' =>
                    $this
                        ->businessDay
                        ->business_date
                        ?->toDateString(),

                    'status' =>
                    $this
                        ->businessDay
                        ->status,
                ]
                : null,

            'cashier_shift' =>
            $this->cashierShift
                ? [
                    'id' =>
                    $this
                        ->cashierShift
                        ->id,

                    'shift_number' =>
                    $this
                        ->cashierShift
                        ->shift_number,

                    'status' =>
                    $this
                        ->cashierShift
                        ->status,
                ]
                : null,

            /*
             * Private storage path is intentionally
             * NOT exposed.
             */
            'receipt' =>
            $this->receipt_path
                ? [
                    'available' =>
                    true,

                    'original_name' =>
                    $this
                        ->receipt_original_name,

                    'mime_type' =>
                    $this
                        ->receipt_mime_type,

                    'size' =>
                    $this
                        ->receipt_size,

                    'uploaded_at' =>
                    $this
                        ->receipt_uploaded_at
                        ?->toISOString(),
                ]
                : null,

            'created_by' =>
            $this->createdBy
                ? [
                    'id' =>
                    $this
                        ->createdBy
                        ->id,

                    'name' =>
                    $this
                        ->createdBy
                        ->name,
                ]
                : null,

            'approved_by' =>
            $this->approvedBy
                ? [
                    'id' =>
                    $this
                        ->approvedBy
                        ->id,

                    'name' =>
                    $this
                        ->approvedBy
                        ->name,
                ]
                : null,

            'created_at' =>
            $this
                ->created_at
                ?->toISOString(),

            'updated_at' =>
            $this
                ->updated_at
                ?->toISOString(),
        ];
    }
}
