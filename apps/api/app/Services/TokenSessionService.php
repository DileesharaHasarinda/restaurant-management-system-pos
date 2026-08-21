<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;

final class TokenSessionService
{
    public function revokeAll(
        User $user,
        ?int $exceptTokenId = null,
        ?string $exceptSessionId = null
    ): array {
        $tokenQuery =
            $user->tokens();

        if ($exceptTokenId !== null) {
            $tokenQuery->where(
                'id',
                '!=',
                $exceptTokenId
            );
        }

        $tokensRevoked =
            $tokenQuery->delete();

        $sessionQuery =
            DB::table('sessions')
            ->where(
                'user_id',
                $user->id
            );

        if ($exceptSessionId !== null) {
            $sessionQuery->where(
                'id',
                '!=',
                $exceptSessionId
            );
        }

        $sessionsRevoked =
            $sessionQuery->delete();

        return [
            'tokens_revoked' =>
            $tokensRevoked,

            'browser_sessions_revoked' =>
            $sessionsRevoked,
        ];
    }

    public function revokeToken(
        User $user,
        int $tokenId
    ): bool {
        return $user
            ->tokens()
            ->where('id', $tokenId)
            ->delete() > 0;
    }
}
