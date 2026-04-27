#!/bin/sh
set -e

mkdir -p /var/www/html/public/geojson
php /var/www/html/bin/console messenger:setup-transports

exec php-fpm --nodaemonize
