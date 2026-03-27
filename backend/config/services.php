<?php

return [
    'docling' => [
        'url' => env('DOCLING_SERVICE_URL', 'http://localhost:8001'),
    ],
    'cors' => [
        'origins' => env('CORS_ORIGINS', 'http://localhost:5173'),
    ],
    'upload' => [
        'max_size' => env('MAX_UPLOAD_SIZE', 52428800),
    ],
    'openrouter' => [
        'api_key' => env('OPENROUTER_API_KEY', ''),
        'api_url' => env('OPENROUTER_API_URL', 'https://openrouter.ai/api/v1'),
        'model' => env('OPENROUTER_MODEL', 'openai/gpt-3.5-turbo'),
    ],
];
