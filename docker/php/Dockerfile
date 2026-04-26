FROM php:8.4-fpm-alpine

ARG UID=1000
ARG GID=1000

# Install system dependencies
RUN apk add --no-cache \
    git \
    curl \
    unzip \
    icu-dev \
    libzip-dev \
    libpng-dev \
    oniguruma-dev \
    libxml2-dev \
    postgresql-dev \
    linux-headers \
    gdal-tools \
    $PHPIZE_DEPS

# Install PHP extensions
RUN docker-php-ext-install \
    pdo_pgsql \
    pgsql \
    intl \
    zip \
    opcache \
    mbstring \
    xml \
    sockets

# Install APCu
RUN pecl install apcu && docker-php-ext-enable apcu

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/local/bin/composer

# Create non-root user matching host UID/GID
RUN addgroup -g ${GID} appgroup && \
    adduser -u ${UID} -G appgroup -s /bin/sh -D appuser

WORKDIR /var/www/html

COPY --chmod=755 docker/php/entrypoint.sh /usr/local/bin/docker-entrypoint.sh

USER appuser

CMD ["/usr/local/bin/docker-entrypoint.sh"]
