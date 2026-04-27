#!/bin/sh
set -e

composer install --no-interaction --optimize-autoloader

mkdir -p /var/www/html/public/geojson
php /var/www/html/bin/console messenger:setup-transports

exec php-fpm --nodaemonize
