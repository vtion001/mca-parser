<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment('PDF Scrubbing made simple!');
})->purpose('Display an inspiring quote');
