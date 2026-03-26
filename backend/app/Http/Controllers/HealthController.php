<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Foundation\Validation\ValidatesRequests;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\JsonResponse;

class HealthController extends BaseController
{
    use AuthorizesRequests, ValidatesRequests;

    public function index(): JsonResponse
    {
        return response()->json([
            'status' => 'healthy',
            'app' => config('app.name'),
            'version' => '1.0.0',
        ]);
    }

    public function ready(): JsonResponse
    {
        return response()->json([
            'ready' => true,
        ]);
    }

    public function docling(): JsonResponse
    {
        $doclingUrl = config('services.docling.url');

        try {
            $response = file_get_contents($doclingUrl . '/health');
            $data = json_decode($response, true);

            return response()->json([
                'status' => 'healthy',
                'service' => 'docling',
                'available' => true,
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
}
