<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(\App\Services\DoclingService::class);
        $this->app->singleton(\App\Services\PdfAnalyzerService::class);
    }

    public function boot(): void
    {
        //
    }
}
