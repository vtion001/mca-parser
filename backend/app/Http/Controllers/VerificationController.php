<?php

namespace App\Http\Controllers;

use App\Services\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

class VerificationController extends BaseController
{
    public function __construct(
        private CustomerService $customerService
    ) {}

    public function verify(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'token' => 'required|string',
        ]);

        $result = $this->customerService->verifyEmail($validated['token']);

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'error' => $result['error'],
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Email verified successfully.',
        ]);
    }

    public function resend(Request $request): JsonResponse
    {
        $user = $request->user();
        $customer = $this->customerService->getCustomerByUserId($user->id);

        if (!$customer) {
            return response()->json([
                'success' => false,
                'error' => 'Customer not found.',
            ], 404);
        }

        if ($customer->isVerified()) {
            return response()->json([
                'success' => false,
                'error' => 'Email already verified.',
            ], 400);
        }

        $token = $this->customerService->resendVerification($customer);

        return response()->json([
            'success' => true,
            'message' => 'Verification email sent.',
            'token' => $token, // Remove in production - only for testing
        ]);
    }
}
