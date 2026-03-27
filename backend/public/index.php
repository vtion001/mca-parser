<?php

use Illuminate\Http\Request;

// Suppress PHP errors from output to keep JSON responses clean
ini_set('display_errors', '0');
error_reporting(E_ALL);

// Increase max execution time for long-running OCR operations
ini_set('max_execution_time', '300');

define('LARAVEL_START', microtime(true));

if (file_exists($maintenance = __DIR__.'/../storage/framework/maintenance.php')) {
    require $maintenance;
}

require __DIR__.'/../vendor/autoload.php';

$app = require_once __DIR__.'/../bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$response = $kernel->handle(
    $request = Request::capture()
)->send();

$kernel->terminate($request, $response);
