<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\HealthController;

Route::prefix('v1')->group(function () {
    Route::get('/health', [HealthController::class, 'index']);
    Route::get('/health/ready', [HealthController::class, 'ready']);
    Route::get('/health/docling', [HealthController::class, 'docling']);

    Route::post('/pdf/upload', [PdfController::class, 'upload']);
    Route::post('/pdf/analyze', [PdfController::class, 'analyze']);
    Route::post('/pdf/scrub', [PdfController::class, 'scrub']);
});
