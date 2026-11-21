<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Lets the browser-based Operations app authenticate with an httpOnly
 * cookie instead of a JS-readable bearer token.
 *
 * CSRF defense: cookie-authenticated requests must carry
 * `X-Requested-With: XMLHttpRequest`. A custom header forces a CORS
 * preflight, which the CORS allowlist rejects for foreign origins; the
 * cookie is also SameSite=Strict.
 */
final class AuthenticateFromCookie
{
    public const COOKIE = 'ops_token';

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->cookie(self::COOKIE);

        if (! $request->bearerToken() && is_string($token) && $token !== '') {
            if ($request->header('X-Requested-With') !== 'XMLHttpRequest') {
                return response()->json([
                    'success' => false,
                    'message' => 'Missing required request header.',
                    'code' => 'CSRF_HEADER_REQUIRED',
                ], 403);
            }

            $request->headers->set('Authorization', 'Bearer ' . $token);
        }

        return $next($request);
    }
}
