#!/usr/bin/env bash
# One-time setup on a fresh Ubuntu 24.04 EC2 instance. Run as root: sudo bash ec2-setup.sh api.example.com ws.example.com
set -euo pipefail
API_HOST=${1:?api host}; WS_HOST=${2:?ws host}
add-apt-repository -y ppa:ondrej/php
apt-get update
apt-get install -y nginx redis-server supervisor git unzip certbot python3-certbot-nginx \
  php8.4-fpm php8.4-cli php8.4-mysql php8.4-mbstring php8.4-xml php8.4-curl php8.4-gd php8.4-bcmath php8.4-intl php8.4-zip php8.4-redis
curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer
mkdir -p /var/www/pos && chown ubuntu:www-data /var/www/pos
sed "s/API_HOST/$API_HOST/;s/WS_HOST/$WS_HOST/" /var/www/pos/deploy/nginx.conf > /etc/nginx/sites-available/pos
ln -sf /etc/nginx/sites-available/pos /etc/nginx/sites-enabled/pos && rm -f /etc/nginx/sites-enabled/default
cp /var/www/pos/deploy/supervisor.conf /etc/supervisor/conf.d/pos.conf
certbot --nginx -d "$API_HOST" -d "$WS_HOST" --non-interactive --agree-tos -m admin@"${API_HOST#*.}" --redirect
nginx -t && systemctl reload nginx && supervisorctl reread && supervisorctl update
