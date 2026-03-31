<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->foreignId('account_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->index('account_id');
        });

        Schema::table('batches', function (Blueprint $table) {
            $table->foreignId('account_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            $table->index('account_id');
        });
    }

    public function down(): void
    {
        Schema::table('documents', function (Blueprint $table) {
            $table->dropForeign(['account_id']);
            $table->dropColumn('account_id');
        });

        Schema::table('batches', function (Blueprint $table) {
            $table->dropForeign(['account_id']);
            $table->dropColumn('account_id');
        });
    }
};
