<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\DB;
use PDO;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(\App\Services\DoclingService::class);
        $this->app->singleton(\App\Services\PdfAnalyzerService::class);
        $this->app->singleton(\App\Services\McaDetectionService::class);
    }

    public function boot(): void
    {
        // Workaround for PgBouncer incompatibility with PostgreSQL prepared statements.
        // The default PDO::ATTR_EMULATE_PREPARES => false in Laravel's Connector.php
        // takes precedence over config due to how array_diff_key (+) handles numeric keys.
        // We set the attribute directly on the PDO connection to ensure it takes effect.
        $this->ensureEmulatedPrepares();
    }

    /**
     * Ensure ATTR_EMULATE_PREPARES is set to true on the PDO connection.
     * This is a workaround for the numeric key merging issue in Laravel's Connector.php
     */
    private function ensureEmulatedPrepares(): void
    {
        if (config('database.default') !== 'pgsql') {
            return;
        }

        try {
            $pdo = DB::connection()->getPdo();
            if ($pdo && $pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES) !== true) {
                $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, true);
            }
        } catch (\Exception $e) {
            // Connection may not exist yet, will be set on first query
        }
    }
}
