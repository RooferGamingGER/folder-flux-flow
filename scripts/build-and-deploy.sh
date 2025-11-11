#!/bin/bash
set -e

echo "🔨 Building frontend..."
npm run build

echo "📦 Deploying to /var/www/nobis-app/..."
sudo rsync -avz --delete dist/ /var/www/nobis-app/

echo "🔄 Reloading Nginx..."
sudo systemctl reload nginx

echo "✅ Deployment complete!"
echo "🌐 App available at: https://nobis-overdick.digital"
