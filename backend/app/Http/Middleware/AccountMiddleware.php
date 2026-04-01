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
        // User must be authenticated (AuthMiddleware sets $request->user)
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthenticated.',
            ], 401);
        }

        // Account ID from header or inferred from authenticated user
        $headerAccountId = $request->header('X-Account-ID') ?? $request->query('account_id');

        // If no header provided, use the user's own account
        if (!$headerAccountId || !is_numeric($headerAccountId) || (int) $headerAccountId <= 0) {
            // Infer account from authenticated user
            $request->attributes->set('account_id', $user->account_id);
            $request->attributes->set('account', $user->account);
            return $next($request);
        }

        $accountId = (int) $headerAccountId;

        // User must belong to the requested account
        if ($user->account_id !== $accountId) {
            Log::warning('User attempted to access account they do not own', [
                'user_id' => $user->id,
                'user_account_id' => $user->account_id,
                'requested_account_id' => $accountId,
                'ip' => $request->ip(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'Invalid account access.',
            ], 403);
        }

        $account = Account::where('id', $accountId)
            ->where('is_active', true)
            ->first();

        if (!$account) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid account access.',
            ], 403);
        }

        $request->attributes->set('account_id', $account->id);
        $request->attributes->set('account', $account);

        Log::debug('Account access granted', [
            'user_id' => $user->id,
            'account_id' => $account->id,
        ]);

        return $next($request);
    }
}
