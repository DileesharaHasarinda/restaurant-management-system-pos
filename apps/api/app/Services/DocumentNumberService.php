<?php

namespace App\Services;

use App\Models\DocumentSequence;
use App\Models\RestaurantSetting;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class DocumentNumberService
{
    public function nextInvoiceNumber(): string
    {
        return $this->next(
            DocumentSequence::TYPE_INVOICE
        );
    }

    public function nextOrderNumber(): string
    {
        return $this->next(
            DocumentSequence::TYPE_ORDER
        );
    }

    public function nextTokenNumber(): string
    {
        return $this->next(
            DocumentSequence::TYPE_TOKEN
        );
    }

    private function next(
        string $type
    ): string {
        return DB::transaction(
            function () use (
                $type
            ): string {
                $sequence =
                    DocumentSequence::query()
                    ->where(
                        'sequence_type',
                        $type
                    )
                    ->lockForUpdate()
                    ->first();

                if (! $sequence) {
                    throw new RuntimeException(
                        "Document sequence {$type} was not found."
                    );
                }

                if (! $sequence->is_active) {
                    throw new RuntimeException(
                        "Document sequence {$type} is inactive."
                    );
                }

                $timezone =
                    RestaurantSetting::query()
                    ->value(
                        'timezone'
                    )
                    ?? 'Asia/Colombo';

                $date =
                    now($timezone);

                $resetKey =
                    $this->resetKey(
                        $sequence
                            ->reset_period,
                        $date
                    );

                if (
                    $sequence
                    ->last_reset_key
                    !== $resetKey
                ) {
                    $sequence
                        ->current_number = 0;

                    $sequence
                        ->last_reset_key =
                        $resetKey;
                }

                $sequence
                    ->current_number++;

                $sequence->save();

                return $this->format(
                    $sequence,
                    $date
                );
            },
            attempts: 3
        );
    }

    private function resetKey(
        string $period,
        $date
    ): string {
        return match ($period) {
            DocumentSequence::RESET_DAILY =>
            $date->format(
                'Ymd'
            ),

            DocumentSequence::RESET_MONTHLY =>
            $date->format(
                'Ym'
            ),

            DocumentSequence::RESET_YEARLY =>
            $date->format(
                'Y'
            ),

            default =>
            'NEVER',
        };
    }

    private function format(
        DocumentSequence $sequence,
        $date
    ): string {
        $number =
            str_pad(
                (string)
                $sequence
                    ->current_number,

                $sequence
                    ->padding,

                '0',

                STR_PAD_LEFT
            );

        $dateSegment =
            match ($sequence
                ->reset_period) {
                DocumentSequence::RESET_DAILY =>
                $date->format(
                    'Ymd'
                ),

                DocumentSequence::RESET_MONTHLY =>
                $date->format(
                    'Ym'
                ),

                DocumentSequence::RESET_YEARLY =>
                $date->format(
                    'Y'
                ),

                default =>
                null,
            };

        $parts = [
            $sequence->prefix,
        ];

        if ($dateSegment) {
            $parts[] =
                $dateSegment;
        }

        $parts[] =
            $number;

        return implode(
            '-',
            $parts
        );
    }
}
