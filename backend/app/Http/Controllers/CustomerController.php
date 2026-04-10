<?php

namespace App\Http\Controllers;

use App\Services\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;

class CustomerController extends BaseController
{
    public function __construct(
        private CustomerService $customerService
    ) {}

    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();
        $customer = $this->customerService->getCustomerByUserId($user->id);

        if (!$customer) {
            return response()->json([
                'success' => false,
                'error' => 'Customer not found.',
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $customer->id,
                'business_name' => $customer->business_name,
                'business_type' => $customer->business_type,
                'annual_revenue' => $customer->annual_revenue,
                'time_in_business' => $customer->time_in_business,
                'email' => $customer->email,
                'email_verified' => $customer->isVerified(),
                'is_active' => $customer->is_active,
                'created_at' => $customer->created_at,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $user = $request->user();
        $customer = $this->customerService->getCustomerByUserId($user->id);

        if (!$customer) {
            return response()->json([
                'success' => false,
                'error' => 'Customer not found.',
            ], 404);
        }

        $validated = $request->validate([
            'business_name' => 'sometimes|string|max:255',
            'business_type' => 'sometimes|string|max:100',
            'annual_revenue' => 'sometimes|numeric|min:0',
            'time_in_business' => 'sometimes|integer|min:0',
        ]);

        $updatedCustomer = $this->customerService->updateCustomer($customer, $validated);

        return response()->json([
            'success' => true,
            'data' => [
                'id' => $updatedCustomer->id,
                'business_name' => $updatedCustomer->business_name,
                'business_type' => $updatedCustomer->business_type,
                'annual_revenue' => $updatedCustomer->annual_revenue,
                'time_in_business' => $updatedCustomer->time_in_business,
                'email' => $updatedCustomer->email,
                'email_verified' => $updatedCustomer->isVerified(),
            ],
        ]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $customer = $this->customerService->getCustomerByUserId($user->id);

        if (!$customer) {
            return response()->json([
                'success' => false,
                'error' => 'Customer not found.',
            ], 404);
        }

        $validated = $request->validate([
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8',
        ]);

        $result = $this->customerService->changePassword(
            $customer,
            $validated['current_password'],
            $validated['new_password']
        );

        if (!$result['success']) {
            return response()->json([
                'success' => false,
                'error' => $result['error'],
            ], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully.',
        ]);
    }
}
