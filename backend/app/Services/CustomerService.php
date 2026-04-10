<?php

namespace App\Services;

use App\Models\Customer;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class CustomerService
{
    public function createCustomer(array $data, int $userId): Customer
    {
        $customer = Customer::create([
            'user_id' => $userId,
            'business_name' => $data['business_name'],
            'business_type' => $data['business_type'] ?? null,
            'annual_revenue' => $data['annual_revenue'] ?? null,
            'time_in_business' => $data['time_in_business'] ?? null,
            'email' => $data['email'],
            'verification_token' => bin2hex(random_bytes(32)),
        ]);

        return $customer;
    }

    public function getCustomerByUserId(int $userId): ?Customer
    {
        return Customer::where('user_id', $userId)->first();
    }

    public function getCustomerByEmail(string $email): ?Customer
    {
        return Customer::where('email', $email)->first();
    }

    public function updateCustomer(Customer $customer, array $data): Customer
    {
        $allowedFields = ['business_name', 'business_type', 'annual_revenue', 'time_in_business'];

        $filteredData = array_intersect_key($data, array_flip($allowedFields));

        if (!empty($filteredData)) {
            $customer->update($filteredData);
        }

        return $customer->fresh();
    }

    public function changePassword(Customer $customer, string $currentPassword, string $newPassword): array
    {
        $user = $customer->user;

        if (!Hash::check($currentPassword, $user->password)) {
            return ['success' => false, 'error' => 'Current password is incorrect.'];
        }

        $user->password = $newPassword;
        $user->save();

        return ['success' => true];
    }

    public function requestPasswordReset(string $email): array
    {
        $customer = Customer::where('email', $email)->first();

        if (!$customer) {
            return ['success' => false, 'error' => 'Customer not found.'];
        }

        $token = $customer->generateResetToken();

        // In production, send email here
        // Mail::to($customer->email)->send(new PasswordResetMail($token));

        return ['success' => true, 'token' => $token];
    }

    public function resetPassword(string $token, string $newPassword): array
    {
        $customer = Customer::where('reset_token', $token)->first();

        if (!$customer) {
            return ['success' => false, 'error' => 'Invalid reset token.'];
        }

        if ($customer->reset_token_expires_at && $customer->reset_token_expires_at->isPast()) {
            $customer->clearResetToken();
            return ['success' => false, 'error' => 'Reset token has expired.'];
        }

        $user = $customer->user;
        $user->password = $newPassword;
        $user->save();

        $customer->clearResetToken();

        return ['success' => true];
    }

    public function verifyEmail(string $token): array
    {
        $customer = Customer::where('verification_token', $token)->first();

        if (!$customer) {
            return ['success' => false, 'error' => 'Invalid verification token.'];
        }

        $customer->verify();

        return ['success' => true];
    }

    public function resendVerification(Customer $customer): string
    {
        $token = $customer->generateVerificationToken();

        // In production, send email here
        // Mail::to($customer->email)->send(new EmailVerificationMail($token));

        return $token;
    }
}
