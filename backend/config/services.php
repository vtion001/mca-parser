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
];
