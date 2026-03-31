<?php

namespace App\Http\Middleware;

use App\Models\Account;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class AccountMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $accountId = $request->header('X-Account-ID') ?? $request->query('account_id');

        // Validate account ID format (must be positive integer)
        if (!$accountId || !is_numeric($accountId) || (int) $accountId <= 0) {
            Log::warning('Account access attempted with invalid account ID', [
                'account_id' => $accountId,
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Invalid account access.',
            ], 401);
        }

        $accountId = (int) $accountId;

        $account = Account::where('id', $accountId)
            ->where('is_active', true)
            ->first();

        if (!$account) {
            // Use generic message to prevent account enumeration
            Log::info('Account access failed for account ID', [
                'account_id' => $accountId,
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Invalid account access.',
            ], 403);
        }

        // Store account context for downstream use
        $request->attributes->set('account_id', $account->id);
        $request->attributes->set('account', $account);

        Log::debug('Account access granted', [
            'account_id' => $account->id,
        ]);

        return $next($request);
    }
}
