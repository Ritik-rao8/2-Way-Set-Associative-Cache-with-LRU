# Demo checklist

## Rehearse the prototype

1. From the repository root, run `./run.sh demo`. Point out the two cache
   configurations and their equal capacity of 64 bytes.
2. Follow A → B → A → C → A → B in the terminal. On the second access
   to A, explain why it hits in the two-way cache. When C arrives, show
   that B is evicted and A survives. End with the totals of 42 direct-mapped
   cycles and 32 two-way cycles for this sequence.
3. Open `results/waveforms/2way_demo.vcd` and follow the CPU request and
   response for the third and fourth reads. Use the [waveform guide](evaluation.md)
   to identify the signals to show.

## Show the evaluation and individual work

1. Run `./run.sh compare`. Show the conflict trace and the three-block trace
   side by side. Explain where the third address maps in each cache and why
   the two workloads favor different designs.
2. Run `./run.sh synth` and show the cell counts and the netlist regression
   results. Describe the counts as generic Yosys cells.
3. Have each team member show one concrete change or piece of evidence.
   Open the relevant pull request, waveform, test output, or report section
   while that person explains what they contributed and how they checked it.

## Before submission

- Rebuild both PDFs using the [report instructions](../reports/README.md).
- Confirm all five author names and contribution statements with the team.
- Record the prototype and verify that the evaluator can access the video
  and repository from the links in the submission.
