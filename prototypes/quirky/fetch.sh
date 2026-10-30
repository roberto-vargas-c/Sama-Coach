#!/usr/bin/env bash
# fetch.sh pose:jobid ... — waits for each Krea result and saves it as poses/<pose>.png
# The CDN caches a 404 for a result fetched before it is ready, so every try uses a fresh query string.
cd "$(dirname "$0")"
for pair in "$@"; do
  pose=${pair%%:*}; job=${pair#*:}
  for i in $(seq 200); do
    for ext in png jpeg; do
      if curl -sSf -o "poses/$pose.tmp" "https://app-uploads.krea.ai/public/$job-image.$ext?t=$i$RANDOM" 2>/dev/null; then
        python3 -c "from PIL import Image;Image.open('poses/$pose.tmp').convert('RGB').save('poses/$pose.png')" && rm "poses/$pose.tmp"; echo "ok $pose"; continue 3
      fi
    done
    sleep 3
  done
  echo "MISSING $pose $job"
done
