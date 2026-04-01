<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('api_token', 64)->unique()->nullable();
            $table->timestamps();

            $table->index('api_token');
            $table->index('account_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('users');
    }
};
