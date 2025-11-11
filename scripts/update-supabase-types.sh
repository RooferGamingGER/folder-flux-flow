#!/bin/bash
set -e

echo "📝 Generating Supabase types from local instance..."

# Supabase muss lokal laufen (http://localhost:8000)
npx supabase gen types typescript \
  --url http://localhost:8000 \
  --anon-key WlfcSIeL2PrnArmA0y4sqy8jLHMRYg8BAJLbvUIg \
  > src/integrations/supabase/types.ts

echo "✅ Types updated successfully!"
echo "⚠️  Remember to rebuild and deploy: npm run build && ./scripts/build-and-deploy.sh"
