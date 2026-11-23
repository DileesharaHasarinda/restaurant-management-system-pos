#!/usr/bin/env bash
# Run on EC2 for every release: bash /var/www/pos/deploy/deploy.sh
set -euo pipefail
cd /var/www/pos && git fetch origin prod && git reset --hard origin/prod
cd apps/api
composer install --no-dev --optimize-autoloader --no-interaction
php artisan migrate --force
php artisan config:cache && php artisan route:cache && php artisan event:cache
sudo chown -R www-data:www-data storage bootstrap/cache
sudo supervisorctl restart pos-queue pos-reverb
sudo systemctl reload php8.4-fpm
