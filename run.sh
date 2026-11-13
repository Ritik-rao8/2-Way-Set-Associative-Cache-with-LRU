#!/bin/sh
# Run from anywhere. Measured evidence goes to results/ and temporary files to build/.
set -eu
cd "$(dirname "$0")"

cache_name() {
  case "$1" in
    direct) printf 'Direct-mapped' ;;
    2way) printf 'Two-way LRU' ;;
  esac
}

compile_cache() (
  cache=$1 delay=$2 executable=$3 design=$4
  set --
  if [ "$cache" = 2way ]; then
    set -- -DTWO_WAY
  fi
  iverilog -g2005 -Wall "$@" -s cache_tb -Pcache_tb.LATENCY="$delay" \
    -o "$executable" "$design" verilog/sim/memory.v verilog/sim/cache_tb.v
)

run_logged() (
  log=$1
  shift
  "$@" > "$log" 2>&1 || {
    status=$?
    cat "$log" >&2
    printf '\nFull log: %s\n' "$log" >&2
    exit "$status"
  }
)

verified_requests() {
  awk '/^TOTAL VERIFIED REQUESTS: / { print $NF }' "$1"
}

mode=${1:-test}
case "$mode" in
  demo)
    mkdir -p build results/waveforms
    printf 'LRU eviction demo\n'
    printf 'Both caches start empty. Simulated memory delay: 3 cycles.\n'
    printf 'Read order: A (0x0000), B (0x0040), A, C (0x0080), A, B\n'
    for cache in direct 2way; do
      printf '\n%s\n' "$(cache_name "$cache")"
      executable="build/${cache}_demo.vvp"
      log="build/demo_${cache}.log"
      compile_cache "$cache" 3 "$executable" "verilog/rtl/cache_${cache}.v"
      run_logged "$log" vvp "$executable" +demo +wave="results/waveforms/${cache}_demo.vcd"
      sed '/^VCD info: dumpfile .* opened for output\.$/d; /\$finish called at /d' "$log"
    done
    printf '\nRead 3 makes A most recently used in the two-way cache.\n'
    printf 'Read 4 brings in C and evicts B. Read 5 hits A; read 6 misses B.\n'
    printf 'Waveforms: results/waveforms/\n'
    ;;
  smoke)
    mkdir -p build
    iverilog -g2005 -Wall -s smoke_tb -o build/smoke.vvp verilog/sim/smoke_tb.v
    run_logged build/milestone1.log vvp build/smoke.vvp
    sed '/\$finish called at /d' build/milestone1.log
    ;;
  test)
    mkdir -p build
    printf 'RTL regression\n'
    printf 'Checks cover data, hits and misses, LRU, writes, reset, and request timing.\n\n'
    printf '%-14s %20s %18s %8s\n' "Cache" "Memory delay (cycles)" "Checked requests" "Result"
    for cache in direct 2way; do
      for delay in 1 3 7; do
        executable="build/${cache}_${delay}.vvp"
        log="build/test_${cache}_${delay}.log"
        compile_cache "$cache" "$delay" "$executable" "verilog/rtl/cache_${cache}.v"
        run_logged "$log" vvp "$executable" +stage=4
        printf '%-14s %20s %18s %8s\n' "$(cache_name "$cache")" "$delay" "$(verified_requests "$log")" PASS
      done
    done
    printf '\nDetailed logs: build/test_*.log\n\n'
    ./run.sh demo
    ;;
  compare)
    mkdir -p build results/runs
    printf 'Workload comparison\n'
    printf 'Same traces, empty 64-byte caches, four-byte blocks, and 3-cycle memory delay.\n'
    for cache in direct 2way; do
      printf 'Running %s...\n' "$(cache_name "$cache")"
      executable="build/${cache}_trace.vvp"
      compile_cache "$cache" 3 "$executable" "verilog/rtl/cache_${cache}.v"
      for trace in verilog/traces/*.txt; do
        name=$(basename "$trace" .txt)
        run_logged "build/${name}_${cache}.log" vvp "$executable" +trace="$trace" \
          +csv="results/runs/${name}_${cache}.csv" +events="results/runs/${name}_${cache}_events.csv"
      done
    done
    python3 verilog/sim/summarize.py
    ;;
  synth)
    mkdir -p build results/synthesis
    printf 'Yosys synthesis and netlist regression\n'
    printf 'Generic cells are tool-mapped logic. Netlist tests use a 3-cycle memory delay.\n\n'
    printf '%-14s %15s %18s %8s\n' "Cache" "Generic cells" "Checked requests" "Result"
    for cache in direct 2way; do
      stats="results/synthesis/synthesis_${cache}.json"
      netlist="build/netlist_${cache}.v"
      executable="build/netlist_${cache}.vvp"
      log="build/netlist_${cache}_test.log"
      run_logged "build/synthesis_${cache}.log" yosys -Q -T -p \
        "read_verilog verilog/rtl/cache_${cache}.v; synth -top cache_${cache}; check -assert; tee -o $stats stat -json; write_verilog -noattr $netlist"
      # Yosys omits timescale; make simulation units explicit in its output.
      cells=$(python3 -c '
import json
import sys
from pathlib import Path

netlist, stats = map(Path, sys.argv[1:])
netlist.write_text("`timescale 1ns/1ps\n" + netlist.read_text())
print(json.loads(stats.read_text())["design"]["num_cells"])
' "$netlist" "$stats")
      compile_cache "$cache" 3 "$executable" "$netlist"
      run_logged "$log" vvp "$executable" +stage=4
      printf '%-14s %15s %18s %8s\n' "$(cache_name "$cache")" "$cells" "$(verified_requests "$log")" PASS
    done
    printf '\nCell reports: results/synthesis/\n'
    printf 'Detailed logs: build/synthesis_*.log and build/netlist_*_test.log\n'
    ;;
  web-test)
    python3 web/tools/prepare.py
    node web/tools/test.js
    ;;
  web)
    echo "Open http://127.0.0.1:${2:-8765}/ in your browser. Ctrl+C stops the server."
    exec python3 -m http.server "${2:-8765}" --bind 127.0.0.1 --directory web
    ;;
  all)
    ./run.sh smoke
    ./run.sh test
    ./run.sh compare
    ./run.sh synth
    ./run.sh web-test
    ;;
  *) echo "Usage: ./run.sh [demo|smoke|test|compare|synth|web-test|web [port]|all]"; exit 1 ;;
esac
