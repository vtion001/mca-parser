<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\PdfController;
use App\Http\Controllers\HealthController;
use App\Http\Controllers\ExtractionController;
use App\Http\Controllers\DocumentController;
use App\Http\Controllers\BatchController;
use App\Http\Controllers\ComparisonController;
use App\Http\Controllers\AuthController;

Route::prefix('v1')->group(function () {
    Route::get('/health', [HealthController::class, 'index']);
    Route::get('/health/ready', [HealthController::class, 'ready']);
    Route::get('/health/docling', [HealthController::class, 'docling']);

    // Auth endpoints (public)
    Route::post('/auth/register', [AuthController::class, 'register']);
    Route::post('/auth/login', [AuthController::class, 'login']);

    // All API endpoints require auth via Bearer token
    Route::middleware('auth.api')->group(function () {
        // PDF endpoints
        Route::post('/pdf/upload', [PdfController::class, 'upload']);
        Route::post('/pdf/analyze', [PdfController::class, 'analyze']);
        Route::post('/pdf/scrub', [PdfController::class, 'scrub']);
        Route::post('/pdf/full-extract', [ExtractionController::class, 'fullExtract']);
        Route::get('/pdf/progress/{jobId}', [ExtractionController::class, 'progress']);

        // Auth management
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);

        // Document/batch management — account-isolated
        Route::middleware('account')->group(function () {
            Route::get('/documents', [DocumentController::class, 'index']);
            Route::get('/documents/{id}', [DocumentController::class, 'show']);
            Route::delete('/documents/{id}', [DocumentController::class, 'destroy']);
            Route::patch('/documents/{id}/status', [DocumentController::class, 'updateStatus']);

            Route::get('/batches', [BatchController::class, 'index']);
            Route::post('/batches', [BatchController::class, 'store']);
            Route::get('/batches/{id}', [BatchController::class, 'show']);
            Route::post('/batches/{id}/documents', [BatchController::class, 'addDocuments']);
            Route::post('/batches/{id}/process', [BatchController::class, 'startProcessing']);
            Route::get('/batches/{id}/progress', [BatchController::class, 'getProgress']);

            Route::post('/documents/compare', [ComparisonController::class, 'compare']);
        });
    });
});
