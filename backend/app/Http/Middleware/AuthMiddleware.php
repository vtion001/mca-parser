<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use PDO;
use Symfony\Component\HttpFoundation\Response;

class AuthMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (!$token) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthenticated.',
            ], 401);
        }

        // Ensure ATTR_EMULATE_PREPARES is set to true before any query.
        // This is a workaround for Laravel's Connector.php which incorrectly
        // merges default options with config options using array_diff_key (+),
        // causing the numeric key ATTR_EMULATE_PREPARES (key=2) from defaults
        // to take precedence over the config value.
        $this->ensureEmulatedPrepares();

        $user = User::where('api_token', $token)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthenticated.',
            ], 401);
        }

        // Check token expiry
        if ($user->token_expires_at && $user->token_expires_at->isPast()) {
            return response()->json([
                'success' => false,
                'error' => 'Token expired.',
            ], 401);
        }

        $request->attributes->set('user', $user);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }

    /**
     * Ensure ATTR_EMULATE_PREPARES is set to true on the PDO connection.
     * This fixes the PgBouncer "prepared statement does not exist" error.
     */
    private function ensureEmulatedPrepares(): void
    {
        try {
            $connection = DB::connection();
            $pdo = $connection->getPdo();

            if ($pdo && $pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES) !== true) {
                $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);
            }
        } catch (\Exception $e) {
            // If connection fails, let the query handle the error
        }
    }
}
