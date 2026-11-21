<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets the browser-based Operations app authenticate with an httpOnly
 * cookie instead of a JS-readable bearer token.
 *
 * CSRF defense (layered): SameSite=Strict cookie, required
 * `X-Requested-With: XMLHttpRequest` header (forces a CORS preflight), and
 * an exact Origin/Referer match against `auth.cookie_allowed_origins`.
 */
final class AuthenticateFromCookie
{
    public const COOKIE = 'ops_token';

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->cookie(self::COOKIE);

        if (! $request->bearerToken() && is_string($token) && $token !== '') {
            if (
                $request->header('X-Requested-With') !== 'XMLHttpRequest'
                || ! $this->originAllowed($request)
            ) {
                return response()->json([
                    'success' => false,
                    'message' => 'Cookie authentication is not allowed for this request.',
                    'code' => 'CSRF_REJECTED',
                ], 403);
            }

            $request->headers->set('Authorization', 'Bearer ' . $token);
        }

        return $next($request);
    }

    /**
     * Cookie auth is bound to the Operations origin(s): the Origin header
     * (or Referer when Origin is absent) must match exactly. Missing both
     * is rejected.
     */
    private function originAllowed(Request $request): bool
    {
        $source = $request->headers->get('Origin') ?: $request->headers->get('Referer');

        if (! is_string($source) || $source === '') {
            return false;
        }

        $parts = parse_url($source);

        if (! isset($parts['scheme'], $parts['host'])) {
            return false;
        }

        $origin = $parts['scheme'] . '://' . $parts['host']
            . (isset($parts['port']) ? ':' . $parts['port'] : '');

        return in_array($origin, (array) config('auth.cookie_allowed_origins', []), true);
    }
}
