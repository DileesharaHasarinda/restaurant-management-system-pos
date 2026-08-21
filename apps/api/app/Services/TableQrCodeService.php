<?php

namespace App\Services;

use App\Exceptions\TableOperationException;
use App\Models\RestaurantTable;
use App\Models\TableQrToken;
use App\Models\User;
use App\Support\DatabaseTransaction;
use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Encoding\Encoding;
use Endroid\QrCode\ErrorCorrectionLevel;
use Endroid\QrCode\RoundBlockSizeMode;
use Endroid\QrCode\Writer\SvgWriter;

final class TableQrCodeService
{
    public function __construct(
        private readonly AuditLogger $auditLogger
    ) {}

    public function orderUrl(
        TableQrToken $token
    ): string {
        return sprintf(
            '%s/%s',
            rtrim(
                (string)
                config(
                    'restaurant.customer_order_base_url'
                ),
                '/'
            ),
            $token->token
        );
    }

    public function createToken(
        RestaurantTable $table,
        ?User $actor = null
    ): TableQrToken {
        return TableQrToken::query()
            ->create([
                'table_id' =>
                $table->id,

                /*
                 * 128 bits of cryptographically
                 * secure randomness.
                 */
                'token' =>
                bin2hex(
                    random_bytes(16)
                ),

                'is_active' =>
                true,

                'expires_at' =>
                null,

                'last_scanned_at' =>
                null,

                'generated_by' =>
                $actor?->id,

                'disabled_at' =>
                null,

                'disabled_by' =>
                null,
            ]);
    }

    public function ensureActiveToken(
        RestaurantTable $table,
        ?User $actor = null
    ): TableQrToken {
        /** @var TableQrToken|null $token */
        $token =
            $table
            ->qrTokens()
            ->where(
                'is_active',
                true
            )
            ->latest('id')
            ->first();

        if (
            $token !== null
            && $token->isUsable()
        ) {
            return $token;
        }

        return DatabaseTransaction::run(
            function () use (
                $table,
                $actor
            ): TableQrToken {
                /** @var RestaurantTable $lockedTable */
                $lockedTable =
                    RestaurantTable::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $table->id
                    );

                /** @var TableQrToken|null $existing */
                $existing =
                    $lockedTable
                    ->qrTokens()
                    ->where(
                        'is_active',
                        true
                    )
                    ->latest('id')
                    ->first();

                if (
                    $existing !== null
                    && $existing->isUsable()
                ) {
                    return $existing;
                }

                return $this->createToken(
                    $lockedTable,
                    $actor
                );
            }
        );
    }

    public function regenerate(
        RestaurantTable $table,
        User $actor
    ): TableQrToken {
        return DatabaseTransaction::run(
            function () use (
                $table,
                $actor
            ): TableQrToken {
                /** @var RestaurantTable $lockedTable */
                $lockedTable =
                    RestaurantTable::query()
                    ->lockForUpdate()
                    ->findOrFail(
                        $table->id
                    );

                $oldTokenIds =
                    $lockedTable
                    ->qrTokens()
                    ->where(
                        'is_active',
                        true
                    )
                    ->pluck('id')
                    ->all();

                $lockedTable
                    ->qrTokens()
                    ->where(
                        'is_active',
                        true
                    )
                    ->update([
                        'is_active' =>
                        false,

                        'disabled_at' =>
                        now(),

                        'disabled_by' =>
                        $actor->id,

                        'updated_at' =>
                        now(),
                    ]);

                $token =
                    $this->createToken(
                        $lockedTable,
                        $actor
                    );

                $this->auditLogger
                    ->record(
                        action: 'TABLE_QR_REGENERATED',

                        entityType: 'table',

                        entityId: $lockedTable->id,

                        oldValues: [
                            'active_qr_token_ids' =>
                            $oldTokenIds,
                        ],

                        newValues: [
                            'active_qr_token_id' =>
                            $token->id,
                        ],

                        userId: $actor->id
                    );

                return $token;
            }
        );
    }

    public function resolve(
        string $token
    ): TableQrToken {
        /** @var TableQrToken|null $qrToken */
        $qrToken =
            TableQrToken::query()
            ->with([
                'restaurantTable.openSession',
            ])
            ->where(
                'token',
                $token
            )
            ->first();

        if (
            $qrToken === null
            || ! $qrToken->isUsable()
        ) {
            throw new TableOperationException(
                message: 'This table QR code is invalid or no longer active.',

                errorCode: 'INVALID_TABLE_QR',

                status: 404
            );
        }

        /** @var RestaurantTable|null $restaurantTable */
        $restaurantTable =
            $qrToken->restaurantTable;

        if ($restaurantTable === null) {
            throw new TableOperationException(
                message: 'The table linked to this QR code could not be found.',

                errorCode: 'TABLE_NOT_FOUND',

                status: 404
            );
        }

        if (! $restaurantTable->is_active) {
            throw new TableOperationException(
                message: 'This table is currently unavailable.',

                errorCode: 'TABLE_INACTIVE',

                status: 403
            );
        }

        if (
            ! $restaurantTable
                ->qr_ordering_enabled
        ) {
            throw new TableOperationException(
                message: 'QR ordering is currently disabled for this table.',

                errorCode: 'QR_ORDERING_DISABLED',

                status: 403
            );
        }

        $qrToken->forceFill([
            'last_scanned_at' =>
            now(),
        ]);

        $qrToken->save();

        return $qrToken;
    }

    public function svg(
        TableQrToken $token,
        int $size = 600
    ): string {
        $builder =
            new Builder(
                writer: new SvgWriter(),

                writerOptions: [
                    SvgWriter::WRITER_OPTION_EXCLUDE_XML_DECLARATION =>
                    true,
                ],

                validateResult: false,

                data: $this->orderUrl(
                    $token
                ),

                encoding: new Encoding(
                    'UTF-8'
                ),

                errorCorrectionLevel: ErrorCorrectionLevel::High,

                size: $size,

                margin: 20,

                roundBlockSizeMode: RoundBlockSizeMode::None,
            );

        return $builder
            ->build()
            ->getString();
    }
}
