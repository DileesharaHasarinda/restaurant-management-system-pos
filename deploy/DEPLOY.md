# AWS deployment

Domains used below (replace): `api.example.com` (API), `ws.example.com` (Reverb), `ops.example.com` (operations), `www.example.com` (website).
Keep operations and API on the **same site** (same parent domain) — cookie auth is SameSite=Strict.

## 1. Database + Redis
- RDS MySQL 8 (private, security group allows 3306 from the EC2 SG only). Redis runs on the EC2 box (installed by the setup script).

## 2. API on EC2
1. Launch Ubuntu 24.04 `t3.small`+; SG: 22 (your IP), 80/443 (world). Attach an Elastic IP; point `api.` and `ws.` A records at it.
2. `git clone -b prod <repo> /var/www/pos` (as `ubuntu`), then `sudo bash /var/www/pos/deploy/ec2-setup.sh api.example.com ws.example.com`.
3. `cp apps/api/.env.production.example apps/api/.env`, fill in (DB_*, APP_KEY via `php artisan key:generate`, REVERB_*, `CORS_ALLOWED_ORIGINS`, `OPERATIONS_ORIGINS`, `TRUSTED_PROXIES`, `REVERB_HOST=ws.example.com`).
4. `bash /var/www/pos/deploy/deploy.sh` (also run for every release). `php artisan storage:link` once.

## 3. Web apps on Amplify
Each lives in its own repo (sibling dirs `restaurant-pos-website`, `restaurant-pos-operations`); each has an `amplify.yml` at its root. Create one plain Amplify app per repo (no monorepo setting), branch `prod`.
- **restaurant-pos-website** — platform *Web Compute* (Next.js SSR). Env: `RESTAURANT_API_BASE_URL`, `NEXT_PUBLIC_ASSET_BASE_URL`, `NEXT_PUBLIC_REVERB_*`.
- **restaurant-pos-operations** — static SPA. Env: `VITE_API_BASE_URL`, `VITE_REVERB_*`. Add rewrite rule `</^[^.]+$|\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json)$)([^.]+$)/>` → `/index.html` (200).
- Add custom domains `www.` and `ops.`; then set API `CORS_ALLOWED_ORIGINS` / `OPERATIONS_ORIGINS` to the final origins and rerun `php artisan config:cache`.
