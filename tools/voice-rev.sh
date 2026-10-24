#!/bin/sh
# The voice recordings and the pose models' weights are served from the public repository (jsDelivr), pinned to the commit of their last change,
# so they are not uploaded with every Vercel deploy. Run this after committing new or changed recordings, then
# push to origin (the public repo) before deploying, and commit the updated index.html.
cd "$(dirname "$0")/.." || exit 1
rev=$(git log -1 --format=%H -- 'voice/*.mp3')
sed -i "s/^const VOICE_REV = '[0-9a-f]*';/const VOICE_REV = '$rev';/" index.html
mrev=$(git log -1 --format=%H -- '*-weights.wasm')
sed -i "s/^const MODEL_REV = '[0-9a-f]*';/const MODEL_REV = '$mrev';/" index.html
sed -i "s/REV = '[0-9a-f]\{40\}'/REV = '$mrev'/" review/index.html
grep -n "^const VOICE_REV\|^const MODEL_REV" index.html
