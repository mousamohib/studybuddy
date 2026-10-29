# Scrawlie video engine

Makes the promo video frame by frame: a 3D sticky-note mascot (three.js) plus animated HTML scenes, timed to a 120 BPM beat grid (beat = 0.5 s, bar = 2 s).

```
cd marketing/video
npm init -y && npm i three@0.170.0 playwright
python3 serve.py "$PWD" &          # serves this folder on http://127.0.0.1:8765
bash render_all.sh                 # renders 16:9 and 9:16 MP4s (48 s, 30 fps) with ffmpeg
node frames.js 1920 1080 stills 30 "1,7.5,16.6"   # just a few still frames to check
```

- `video.html`: all scenes and timings (`window.render(t)`); `?w=1080&h=1920` for vertical
- `mascot.js`: the 3D mascot (expressions, arms/legs, peeling corner)
- `assets/`: app screenshots, fonts, icon
