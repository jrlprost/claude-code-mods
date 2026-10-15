#!/bin/bash
# Prints the jr mods banner in the jr gradient (violet, pink, amber), one colour per column.
# Needs a truecolor terminal (Ghostty, iTerm2, kitty, WezTerm, recent Terminal.app).
set -euo pipefail

LINES=(
'     ██╗██████╗    ███╗   ███╗ ██████╗ ██████╗ ███████╗'
'     ██║██╔══██╗   ████╗ ████║██╔═══██╗██╔══██╗██╔════╝'
'     ██║██████╔╝   ██╔████╔██║██║   ██║██║  ██║███████╗'
'██   ██║██╔══██╗   ██║╚██╔╝██║██║   ██║██║  ██║╚════██║'
'╚█████╔╝██║  ██║   ██║ ╚═╝ ██║╚██████╔╝██████╔╝███████║'
' ╚════╝ ╚═╝  ╚═╝   ╚═╝     ╚═╝ ╚═════╝ ╚═════╝ ╚══════╝'
)
# Gradient stops: #7f5af0 → #ff5ca8 → #ffb86b
STOPS=(127 90 240  255 92 168  255 184 107)
WIDTH=55

color_at() { # column → "r;g;b"
  local col=$1 seg local_t a b r g bl
  # position along the two segments, in thousandths
  local t=$(( col * 2000 / (WIDTH - 1) ))
  seg=$(( t >= 1000 ? 1 : 0 ))
  local_t=$(( t - seg * 1000 ))
  a=$(( seg * 3 )); b=$(( a + 3 ))
  r=$(( STOPS[a]   + (STOPS[b]   - STOPS[a])   * local_t / 1000 ))
  g=$(( STOPS[a+1] + (STOPS[b+1] - STOPS[a+1]) * local_t / 1000 ))
  bl=$(( STOPS[a+2] + (STOPS[b+2] - STOPS[a+2]) * local_t / 1000 ))
  printf '%d;%d;%d' "$r" "$g" "$bl"
}

echo
for line in "${LINES[@]}"; do
  out='  '
  for (( i = 0; i < ${#line}; i++ )); do
    ch=${line:i:1}
    if [[ $ch == ' ' ]]; then out+=' '; else out+=$'\e[1;38;2;'"$(color_at "$i")m$ch"; fi
  done
  printf '%s\e[0m\n' "$out"
done
printf '\n  \e[38;2;192;202;245mfor Claude Code\e[0m   \e[38;2;107;112;137mmods I build because I need them\e[0m\n\n'
