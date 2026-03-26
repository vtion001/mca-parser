<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CorsMiddleware
{
    public function handle(Request $request, Closure $next): Response
    {
        $origins = explode(',', config('services.cors.origins', 'http://localhost:5173'));

        $origin = $request->header('Origin');

        if (in_array($origin, $origins) || in_array('*', $origins)) {
            $response = $next($request);
            $response->headers->set('Access-Control-Allow-Origin', $origin);
            $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
            $response->headers->set('Access-Control-Max-Age', '86400');

            return $response;
        }

        return $next($request);
    }
}
