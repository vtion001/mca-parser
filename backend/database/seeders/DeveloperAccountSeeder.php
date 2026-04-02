<?php

namespace Database\Seeders;

use App\Models\Account;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DeveloperAccountSeeder extends Seeder
{
    public function run(): void
    {
        $account = Account::firstOrCreate(
            ['slug' => 'dev'],
            ['name' => 'Dev Account', 'is_active' => true]
        );

        if (!User::where('email', 'dev@example.com')->exists()) {
            $user = User::create([
                'account_id' => $account->id,
                'name' => 'Developer',
                'email' => 'dev@example.com',
                'password' => Hash::make('password123'),
                'api_token' => bin2hex(random_bytes(32)),
            ]);

            echo "=== DEV ACCOUNT CREATED ===" . PHP_EOL;
            echo "Email:    dev@example.com" . PHP_EOL;
            echo "Password: password123" . PHP_EOL;
            echo "Account:  Dev Account (ID: {$account->id})" . PHP_EOL;
            echo "Token:    {$user->api_token}" . PHP_EOL;
        } else {
            $user = User::where('email', 'dev@example.com')->first();
            echo "=== DEV ACCOUNT EXISTS ===" . PHP_EOL;
            echo "Email:    dev@example.com" . PHP_EOL;
            echo "Password: password123" . PHP_EOL;
            echo "Account:  Dev Account (ID: {$account->id})" . PHP_EOL;
            echo "Token:    {$user->api_token}" . PHP_EOL;
        }
    }
}
