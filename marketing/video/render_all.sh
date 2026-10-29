set -e
cd "$(dirname "$0")"
rm -rf fL fV
node frames.js 1920 1080 fL 30 > logL.txt 2>&1
ffmpeg -v error -y -framerate 30 -i fL/%05d.jpg -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart scrawlie_promo_16x9.mp4
node frames.js 1080 1920 fV 30 > logV.txt 2>&1
ffmpeg -v error -y -framerate 30 -i fV/%05d.jpg -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -movflags +faststart scrawlie_promo_9x16.mp4
echo DONE > done.txt
