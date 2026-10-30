#!/usr/bin/env bash
# Builds preview.html: trims the settled tail (the last frames snap to the end image), encodes each melt clip forward and reversed, and inlines clips and stills as data URIs.
set -euo pipefail
cd "$(dirname "$0")"; T=$(mktemp -d)
cp preview.template.html "$T/page.html"
sub(){ python3 - "$T/page.html" "$1" "$2" "$3" <<'PY'
import sys,base64
p,key,mime,f=sys.argv[1:]; s=open(p).read()
s=s.replace(key,'data:%s;base64,%s'%(mime,base64.b64encode(open(f,'rb').read()).decode())); open(p,'w').write(s)
PY
}
for pose in mountain warrior2; do
  ffmpeg -v error -y -i "melt-$pose.mp4" -an -vf trim=end_frame=76,setpts=PTS-STARTPTS,scale=960:-2 -c:v libx264 -crf 27 -pix_fmt yuv420p -movflags +faststart "$T/$pose-f.mp4"
  ffmpeg -v error -y -i "melt-$pose.mp4" -an -vf trim=end_frame=76,setpts=PTS-STARTPTS,reverse,scale=960:-2 -c:v libx264 -crf 27 -pix_fmt yuv420p -movflags +faststart "$T/$pose-r.mp4"
  convert "pose-$pose.png" -resize 1280x -quality 84 "$T/$pose.jpg"
  sub "__CLIP_${pose}_f__" video/mp4 "$T/$pose-f.mp4"
  sub "__CLIP_${pose}_r__" video/mp4 "$T/$pose-r.mp4"
  sub "__POSE_${pose}__" image/jpeg "$T/$pose.jpg"
done
convert logo-on-mat.png -resize 1280x -quality 84 "$T/logo.jpg"; sub __LOGO__ image/jpeg "$T/logo.jpg"
mv "$T/page.html" preview.html; ls -la preview.html
