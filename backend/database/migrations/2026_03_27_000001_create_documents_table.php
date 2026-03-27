<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('documents', function (Blueprint $table) {
            $table->id();
            $table->string('filename');
            $table->string('original_filename');
            $table->string('file_path')->nullable();
            $table->enum('status', ['pending', 'processing', 'complete', 'failed'])->default('pending');
            $table->string('document_type')->nullable();
            $table->longText('markdown')->nullable();
            $table->json('key_details')->nullable();
            $table->json('scores')->nullable();
            $table->json('pii_breakdown')->nullable();
            $table->json('recommendations')->nullable();
            $table->json('balances')->nullable();
            $table->json('ai_analysis')->nullable();
            $table->integer('page_count')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();

            $table->index('status');
            $table->index('document_type');
            $table->index('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('documents');
    }
};
