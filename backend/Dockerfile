FROM php:8.2-fpm

WORKDIR /var/www/html

RUN apt-get update && apt-get install -y \
    git \
    curl \
    libpng-dev \
    libonig-dev \
    libxml2-dev \
    zip \
    unzip \
    && docker-php-ext-install mbstring exif pcntl bcmath gd \
    && pecl install redis \
    && docker-php-ext-enable redis

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

COPY backend/composer.json ./
RUN composer install --no-dev --optimize-autoloader --no-scripts

COPY backend/ .

RUN php artisan key:generate --force

EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
