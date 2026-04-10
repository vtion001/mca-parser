<?php

namespace App\Http\Middleware;

use App\Models\Customer;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifiedMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => 'Unauthenticated.',
            ], 401);
        }

        $customer = Customer::where('user_id', $user->id)->first();

        if (!$customer) {
            return response()->json([
                'success' => false,
                'error' => 'Customer profile not found.',
            ], 404);
        }

        if (!$customer->isVerified()) {
            return response()->json([
                'success' => false,
                'error' => 'Email not verified.',
                'needs_verification' => true,
            ], 403);
        }

        $request->attributes->set('customer', $customer);

        return $next($request);
    }
}
