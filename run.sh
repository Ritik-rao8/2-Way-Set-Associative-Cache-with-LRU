#!/bin/sh
# Run from anywhere; all generated files stay inside this project.
set -eu
cd "$(dirname "$0")"
mkdir -p results
mode=${1:-test}
case "$mode" in
  smoke)
    iverilog -g2005 -Wall -s smoke_tb -o results/smoke.vvp sim/smoke_tb.v
    vvp results/smoke.vvp > results/milestone1.log
    cat results/milestone1.log
    ;;
  test)
    for cache in direct 2way; do
      define=""
      if [ "$cache" = 2way ]; then define="-DTWO_WAY"; fi
      for delay in 1 3 7; do
        iverilog -g2005 -Wall $define -s cache_tb -Pcache_tb.LATENCY="$delay" \
          -o "results/${cache}_${delay}.vvp" "rtl/cache_${cache}.v" sim/memory.v sim/cache_tb.v
        vvp "results/${cache}_${delay}.vvp" +stage=4 > "results/test_${cache}_${delay}.log"
        cat "results/test_${cache}_${delay}.log"
      done
      # A short directed waveform, instead of an enormous random-test dump.
      vvp "results/${cache}_3.vvp" +stage=3 +wave="results/${cache}_demo.vcd" \
        > "results/wave_${cache}.log"
    done
    ;;
  compare)
    for cache in direct 2way; do
      define=""
      if [ "$cache" = 2way ]; then define="-DTWO_WAY"; fi
      iverilog -g2005 -Wall $define -s cache_tb -Pcache_tb.LATENCY=3 \
        -o "results/${cache}_3.vvp" "rtl/cache_${cache}.v" sim/memory.v sim/cache_tb.v
      for trace in traces/*.txt; do
        name=$(basename "$trace" .txt)
        vvp "results/${cache}_3.vvp" +trace="$trace" \
          +csv="results/${name}_${cache}.csv" +events="results/${name}_${cache}_events.csv" \
          > "results/${name}_${cache}.log"
      done
    done
    python3 sim/summarize.py
    ;;
  synth)
    for cache in direct 2way; do
      yosys -Q -T -p "read_verilog rtl/cache_${cache}.v; synth -top cache_${cache}; check -assert; tee -o results/synthesis_${cache}.json stat -json; write_verilog -noattr results/netlist_${cache}.v" \
        > "results/synthesis_${cache}.log"
      # Yosys omits timescale; make simulation units explicit in its output.
      python3 -c 'import sys; from pathlib import Path; p=Path(sys.argv[1]); p.write_text("`timescale 1ns/1ps\n" + p.read_text())' "results/netlist_${cache}.v"
      define=""
      if [ "$cache" = 2way ]; then define="-DTWO_WAY"; fi
      # Re-run the same behavioral checks on the synthesized gate netlist.
      iverilog -g2005 -Wall $define -s cache_tb -Pcache_tb.LATENCY=3 \
        -o "results/netlist_${cache}.vvp" sim/memory.v sim/cache_tb.v "results/netlist_${cache}.v"
      vvp "results/netlist_${cache}.vvp" +stage=4 > "results/netlist_${cache}_test.log"
      cat "results/netlist_${cache}_test.log"
    done
    ;;
  web-test)
    python3 sim/prepare_web.py
    node sim/web_test.js
    ;;
  web)
    echo "Open http://127.0.0.1:8765/web/ in your browser. Ctrl+C stops the server."
    python3 -m http.server 8765 --bind 127.0.0.1
    ;;
  all)
    ./run.sh smoke
    ./run.sh test
    ./run.sh compare
    ./run.sh synth
    ./run.sh web-test
    ;;
  *) echo "Usage: ./run.sh [smoke|test|compare|synth|web-test|web|all]"; exit 1 ;;
esac
