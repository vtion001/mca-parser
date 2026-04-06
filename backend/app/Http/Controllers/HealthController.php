<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

class HealthController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function index(): JsonResponse
    {
        return response()->json([
            'status' => 'healthy',
            'app' => config('app.name'),
            'version' => '1.0.0',
            'timestamp' => now()->toIso8601String(),
        ]);
    }

    public function ready(): JsonResponse
    {
        $checks = [
            'mysql' => $this->checkMysql(),
            'redis' => $this->checkRedis(),
            'docling' => $this->checkDocling(),
        ];

        $allHealthy = collect($checks)->every(fn($check) => $check['healthy']);

        return response()->json([
            'ready' => $allHealthy,
            'checks' => $checks,
            'timestamp' => now()->toIso8601String(),
        ], $allHealthy ? 200 : 503);
    }

    public function docling(): JsonResponse
    {
        $doclingUrl = config('services.docling.url');

        try {
            $context = stream_context_create([
                'http' => [
                    'timeout' => 5,
                    'ignore_errors' => true,
                ]
            ]);
            $response = @file_get_contents($doclingUrl . '/health', false, $context);
            $data = json_decode($response, true);

            return response()->json([
                'status' => 'healthy',
                'service' => 'docling',
                'available' => true,
                'details' => $data ?? null,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'status' => 'unhealthy',
                'service' => 'docling',
                'available' => false,
                'error' => $e->getMessage(),
            ], 503);
        }
    }

    private function checkMysql(): array
    {
        try {
            DB::connection()->getPdo();
            $driver = DB::connection()->getDriverName();

            // SQLite doesn't have VERSION(), use sqlite_version() or just confirm connection
            if ($driver === 'sqlite') {
                $version = DB::selectOne('SELECT sqlite_version() as version')->version ?? 'unknown';
            } else {
                $version = DB::selectOne('SELECT VERSION() as version')->version ?? 'unknown';
            }

            return [
                'healthy' => true,
                'driver' => $driver,
                'version' => $version,
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    private function checkRedis(): array
    {
        try {
            Cache::store('redis')->put('health_check', true, 10);
            $value = Cache::store('redis')->get('health_check');

            return [
                'healthy' => $value === true,
                'ping' => 'PONG',
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'error' => $e->getMessage(),
            ];
        }
    }

    private function checkDocling(): array
    {
        try {
            $doclingUrl = config('services.docling.url');
            $context = stream_context_create([
                'http' => [
                    'timeout' => 3,
                    'ignore_errors' => true,
                ]
            ]);
            $response = @file_get_contents($doclingUrl . '/health', false, $context);
            $data = json_decode($response, true);

            return [
                'healthy' => $data['status'] ?? false,
                'device' => $data['device'] ?? null,
                'workers' => $data['workers'] ?? null,
            ];
        } catch (\Exception $e) {
            return [
                'healthy' => false,
                'error' => $e->getMessage(),
            ];
        }
    }
}
