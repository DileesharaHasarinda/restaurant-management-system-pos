<?php

namespace App\Services;

use App\Exceptions\InventoryOperationException;
use App\Models\Unit;

final class UnitConversionService
{
    public function convert(
        float $quantity,
        Unit $fromUnit,
        Unit $toUnit
    ): float {
        if ($quantity < 0) {
            throw new InventoryOperationException(
                message: 'Quantity cannot be negative.',

                errorCode: 'INVALID_QUANTITY',

                status: 422
            );
        }

        [
            $fromRoot,
            $fromFactor,
        ] = $this->rootAndFactor(
            $fromUnit
        );

        [
            $toRoot,
            $toFactor,
        ] = $this->rootAndFactor(
            $toUnit
        );

        /*
         * Units must eventually point to
         * the same physical root unit.
         *
         * KG -> G ✅
         * L  -> ML ✅
         * KG -> ML ❌
         * PACK -> PCS ❌ unless a specific
         * ingredient conversion is defined later.
         */
        if (
            $fromRoot->id
            !== $toRoot->id
        ) {
            throw new InventoryOperationException(
                message: 'These units are not compatible for conversion.',

                errorCode: 'INCOMPATIBLE_UNITS',

                status: 422
            );
        }

        $rootQuantity =
            $quantity
            * $fromFactor;

        return round(
            $rootQuantity
                / $toFactor,
            6
        );
    }

    public function toRoot(
        float $quantity,
        Unit $unit
    ): array {
        [
            $root,
            $factor,
        ] = $this->rootAndFactor(
            $unit
        );

        return [
            'quantity' =>
            round(
                $quantity
                    * $factor,
                6
            ),

            'unit' =>
            $root,
        ];
    }

    private function rootAndFactor(
        Unit $unit
    ): array {
        $current =
            $unit;

        $factor =
            1.0;

        $visited = [];

        while (
            $current->base_unit_id
            !== null
        ) {
            if (
                in_array(
                    $current->id,
                    $visited,
                    true
                )
            ) {
                throw new InventoryOperationException(
                    message: 'A circular unit conversion was detected.',

                    errorCode: 'UNIT_CONVERSION_CYCLE',

                    status: 500
                );
            }

            $visited[] =
                $current->id;

            $conversionFactor =
                (float)
                $current
                    ->conversion_factor;

            if (
                $conversionFactor <= 0
            ) {
                throw new InventoryOperationException(
                    message: 'Invalid unit conversion factor.',

                    errorCode: 'INVALID_UNIT_CONVERSION',

                    status: 500
                );
            }

            $factor *=
                $conversionFactor;

            $current->loadMissing(
                'baseUnit'
            );

            if (! $current->baseUnit) {
                throw new InventoryOperationException(
                    message: 'The configured base unit could not be found.',

                    errorCode: 'BASE_UNIT_NOT_FOUND',

                    status: 500
                );
            }

            $current =
                $current->baseUnit;
        }

        return [
            $current,
            $factor,
        ];
    }
}
