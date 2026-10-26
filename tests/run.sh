#!/bin/bash
# Runs the tests in a real browser (Playwright's Chromium). See tests/README.md.
#   tests/run.sh                    everything (about 25 minutes)
#   tests/run.sh regress [names]    the paint regressions: this copy against the reference
#   tests/run.sh lock [modes]       the layout lock (modes like desk-light,phone-dark)
#   tests/run.sh vector [names]     Vector mode's checks
#   tests/run.sh brushes            the bristle brushes' checks
#   tests/run.sh selection          selecting: layers, undo and redo, Shift to add
# The reference is origin/main, or REF=<commit or branch>. This copy is served
# on APP_PORT (8123) and the reference on REF_PORT (8124); what they print and
# save goes in tests/.out.
set -u
T=$(cd "$(dirname "$0")" && pwd); ROOT=$(dirname "$T"); OUT="$T/.out"
APP_PORT=${APP_PORT:-8123}; REF_PORT=${REF_PORT:-8124}; REF=${REF:-origin/main}
APP="http://127.0.0.1:$APP_PORT/"; REFURL="http://127.0.0.1:$REF_PORT/"
REGRESS="all fill fx lay pen proj sym3 ui5 touch interact zoom selmodes tx mv lasso pick op"
PIDS=(); FAILED=()
trap 'for p in "${PIDS[@]}"; do kill "$p" 2>/dev/null; done' EXIT

# serve a folder, or check that what's already on the port is that folder
serve() {
  local port=$1 dir=$2 url="http://127.0.0.1:$1/"
  if ! curl -s -o /dev/null "$url/index.html"; then
    python3 -m http.server "$port" --bind 127.0.0.1 --directory "$dir" >/dev/null 2>&1 & PIDS+=($!)
    timeout 20 bash -c "until curl -s -o /dev/null '$url/index.html'; do sleep 0.3; done" || { echo "couldn't serve $dir on $port"; exit 2; }
  fi
  if [ "$(curl -s "$url/paint.js" | md5sum)" != "$(md5sum < "$dir/paint.js")" ]; then
    echo "port $port is serving something other than $dir: stop it, or set APP_PORT / REF_PORT"; exit 2
  fi
}
reference() {
  rm -rf "$T/.ref" && mkdir -p "$T/.ref" && git -C "$ROOT" archive "$REF" | tar -x -C "$T/.ref" || { echo "couldn't take $REF as the reference"; exit 2; }
  serve "$REF_PORT" "$T/.ref"
  echo "reference: $REF ($(git -C "$ROOT" rev-parse --short "$REF"))"
}

# THE PAINT REGRESSIONS print what they see; the same suite runs on both
# copies and what they print is compared. Lines starting with ~ vary from run
# to run (timing, textures) and aren't compared.
regress() {
  reference
  local names=${*:-$REGRESS}
  for t in $names; do
    for side in app ref; do mkdir -p "$OUT/regress/$side/out"; done
    # (one after the other: run side by side, each slows the other and timing shows)
    (cd "$OUT/regress/ref" && PAINT_URL=$REFURL timeout 300 node "$T/regress/$t.js" > "$t.txt" 2>&1)
    (cd "$OUT/regress/app" && PAINT_URL=$APP timeout 300 node "$T/regress/$t.js" > "$t.txt" 2>&1)
    if diff -q <(grep -v '^~' "$OUT/regress/ref/$t.txt") <(grep -v '^~' "$OUT/regress/app/$t.txt") > /dev/null; then echo "same  regress/$t"
    else echo "DIFF  regress/$t"; diff <(grep -v '^~' "$OUT/regress/ref/$t.txt") <(grep -v '^~' "$OUT/regress/app/$t.txt") | head -20 | sed 's/^/      /'; FAILED+=("regress/$t"); fi
  done
}
lock() {
  reference
  mkdir -p "$OUT/lock"
  if (cd "$OUT/lock" && PAINT_URL=$APP PAINT_REF_URL=$REFURL node "$T/layout-lock.js" "${1:-desk-light,phone-light,ipad-light}" > lock.txt 2>&1); then echo "ok    layout lock"
  else echo "MOVED layout lock (all of it in tests/.out/lock/lock.txt)"; grep -E '^[^ ]' "$OUT/lock/lock.txt" | sed 's/^/      /'; FAILED+=(lock); fi
}
# a check that ends with ALL OK
check() {
  local name=$1 dir=$2 f=${1##*/}; shift 2
  mkdir -p "$dir"
  if (cd "$dir" && PAINT_URL=$APP timeout 400 node "$@" > "$f.txt" 2>&1) && tail -1 "$dir/$f.txt" | grep -q 'ALL OK'; then echo "ok    $name"
  else echo "FAIL  $name (all of it in ${dir#$ROOT/}/$f.txt)"; grep -E '^FAIL|Error' "$dir/$f.txt" | head -8 | sed 's/^/      /'; FAILED+=("$name"); fi
}
vector() {
  local names=${*:-$(cd "$T/vector" && ls t*.js | sed 's/\.js$//' | sort -V)}
  for t in $names; do check "vector/$t" "$OUT/vector" "$T/vector/$t.js"; done
}
brushes() {
  check "brushes/bristle-light-1400" "$OUT/brushes" "$T/brushes/bristle.js" light 1400 900
  check "brushes/bristle-dark-375" "$OUT/brushes" "$T/brushes/bristle.js" dark 375 812
}
selection() {
  check "selection/selection-light-1400" "$OUT/selection" "$T/selection/selection.js" light 1400 900
  check "selection/selection-dark-1024" "$OUT/selection" "$T/selection/selection.js" dark 1024 768
}

serve "$APP_PORT" "$ROOT"
what=${1:-all}; [ $# -gt 0 ] && shift
case $what in
  regress) regress "$@" ;;
  lock) lock "$@" ;;
  vector) vector "$@" ;;
  brushes) brushes ;;
  selection) selection ;;
  all) brushes; selection; vector; regress; lock ;;
  *) echo "run.sh [all|regress|lock|vector|brushes|selection] [names]"; exit 2 ;;
esac
if [ ${#FAILED[@]} -gt 0 ]; then echo; echo "not passing: ${FAILED[*]}"; exit 1; fi
echo; echo "all passing"
