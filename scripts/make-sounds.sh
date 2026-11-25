#!/usr/bin/env bash
# Generates the four soft effect sounds in public/sounds/ with ffmpeg (no sample files, no licences).
# Mono, 22.05 kHz, quiet (peak around -10 dB), short fades so nothing clicks. Run: bash scripts/make-sounds.sh
set -euo pipefail
out="$(cd "$(dirname "$0")/.." && pwd)/public/sounds"
mkdir -p "$out"

enc() { # name, duration, lavfi expression, extra filters
  ffmpeg -v error -y -f lavfi -i "$3" -af "$4,volume=0.35" -t "$2" -ac 1 -ar 22050 -c:a libmp3lame -b:a 48k "$out/$1.mp3"
}

# pop: a short sine blip dropping from 700 to 420 Hz (about 80 ms)
enc pop 0.08 "aevalsrc='sin(2*PI*(700*t-1750*t*t))':s=22050:d=0.08" "afade=t=in:d=0.005,afade=t=out:st=0.04:d=0.04"

# ding: a gentle bell, two partials (880 and 1320 Hz) with a soft decay (about 300 ms)
enc ding 0.3 "aevalsrc='(0.7*sin(2*PI*880*t)+0.3*sin(2*PI*1320*t))*exp(-9*t)':s=22050:d=0.3" "afade=t=in:d=0.006,afade=t=out:st=0.2:d=0.1"

# boop: a soft low note sliding down from 330 to 220 Hz (about 250 ms), no harsh edges
enc boop 0.25 "aevalsrc='sin(2*PI*(330*t-220*t*t))*exp(-5*t)':s=22050:d=0.25" "afade=t=in:d=0.01,afade=t=out:st=0.15:d=0.1"

# squeak: a quick rising chirp from 600 to 1400 Hz (about 150 ms)
enc squeak 0.15 "aevalsrc='sin(2*PI*(600*t+2667*t*t))*0.8':s=22050:d=0.15" "afade=t=in:d=0.01,afade=t=out:st=0.09:d=0.06"

ls -l "$out"
