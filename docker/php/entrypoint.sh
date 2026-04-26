#!/bin/sh
set -e

# Create GeoJSON output directory if it doesn't exist
mkdir -p /var/www/html/public/geojson

# Setup messenger transport table (idempotent)
php /var/www/html/bin/console messenger:setup-transports

# Restart loop: when --time-limit expires the worker exits cleanly; restart it
messenger_worker() {
    while true; do
        echo "[messenger] Starting consumer..."
        php /var/www/html/bin/console messenger:consume async --time-limit=3600 -vv || true
        echo "[messenger] Consumer stopped, restarting in 3s..."
        sleep 3
    done
}

messenger_worker &

# Start PHP-FPM as PID 1 (exec replaces the shell so signals are handled correctly)
exec php-fpm --nodaemonize
