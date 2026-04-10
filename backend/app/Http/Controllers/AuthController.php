<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Routing\Controller as BaseController;

class AuthController extends BaseController
{
    public function __construct(
        private CustomerService $customerService
    ) {}

    public function register(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'account_id' => 'required|integer|exists:accounts,id',
            // Customer-specific fields
            'business_name' => 'required|string|max:255',
            'business_type' => 'sometimes|string|max:100',
            'annual_revenue' => 'sometimes|numeric|min:0',
            'time_in_business' => 'sometimes|integer|min:0',
        ]);

        $user = User::create([
            'account_id' => $validated['account_id'],
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => $validated['password'],
            'api_token' => bin2hex(random_bytes(32)),
        ]);

        $customer = $this->customerService->createCustomer([
            'business_name' => $validated['business_name'],
            'business_type' => $validated['business_type'] ?? null,
            'annual_revenue' => $validated['annual_revenue'] ?? null,
            'time_in_business' => $validated['time_in_business'] ?? null,
            'email' => $validated['email'],
        ], $user->id);

        // In production, trigger welcome email here
        // Mail::to($customer->email)->send(new WelcomeMail($customer));

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'account_id' => $user->account_id,
                ],
                'customer' => [
                    'id' => $customer->id,
                    'business_name' => $customer->business_name,
                    'business_type' => $customer->business_type,
                    'email_verified' => false,
                ],
                'token' => $user->api_token,
            ],
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'remember' => 'sometimes|boolean',
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user || !Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'success' => false,
                'error' => 'Invalid credentials.',
            ], 401);
        }

        // Determine token validity period based on "remember me"
        $remember = $validated['remember'] ?? false;
        $tokenDays = $remember ? 30 : 7;

        $token = $user->regenerateToken($tokenDays);

        $customer = $this->customerService->getCustomerByUserId($user->id);

        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'account_id' => $user->account_id,
                ],
                'customer' => $customer ? [
                    'id' => $customer->id,
                    'business_name' => $customer->business_name,
                    'business_type' => $customer->business_type,
                    'annual_revenue' => $customer->annual_revenue,
                    'time_in_business' => $customer->time_in_business,
                    'email' => $customer->email,
                    'email_verified' => $customer->isVerified(),
                    'is_active' => $customer->is_active,
                ] : null,
                'token' => $token,
                'remember' => $remember,
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user) {
            $user->clearToken();
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully.',
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        $customer = $this->customerService->getCustomerByUserId($user->id);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'account_id' => $user->account_id,
                'customer' => $customer ? [
                    'id' => $customer->id,
                    'business_name' => $customer->business_name,
                    'business_type' => $customer->business_type,
                    'email_verified' => $customer->isVerified(),
                ] : null,
            ],
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'email' => 'required|email',
        ]);

        $customer = $this->customerService->getCustomerByEmail($validated['email']);

        // Always return success to prevent email enumeration
        // In production, only send email if customer exists
        if (!$customer) {
            return response()->json([
                'success' => true,
                'message' => 'If the email exists, a reset link has been sent.',
            ]);
        }

        $result = $this->customerService->requestPasswordReset($validated['email']);

        return response()->json([
            'success' => true,
            'message' => 'If the email exists, a reset link has been sent.',
            'token' => $result['token'] ?? null, // Remove in production
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
            'password' => 'required|string|min:8',
        ]);

        $result = $this->customerService->resetPassword(
            $validated['token'],
            $validated['password']
        );

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'error' => $result['error'],
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Password reset successfully.',
        ]);
    }
}
