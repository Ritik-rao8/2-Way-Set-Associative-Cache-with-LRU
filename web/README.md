# Cache Explorer

An optional visual aid for the [Verilog cache project](../README.md).

Open `index.html` in a browser, or run `./run.sh web` from the project root.
For Vercel, select `web` as the Root Directory.

Three visual lessons show alternating blocks, LRU eviction, and neighbouring
bytes. Each request shows cache slots before and after the access. Colored
blocks keep their identity as they enter or leave a slot. The desktop view
keeps both caches side by side. Stepping forward animates fills, evictions,
and hits, with reduced-motion support. Each completed lesson shows its
hit/miss sequence and total-cycle bars.

The default lesson alternates A and B. **Which block leaves?** follows
A → B → A → C → A → B to verify LRU eviction. **Fetch the neighbours**
shows one four-byte fetch followed by three hits. Use **Next access**,
**Previous**, or the request buttons to step through each lesson.

Expand **More examples & workloads** for measured traces and write examples.
Address fields, all cache lines, custom requests, and measured results are
available in expandable sections.

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `script.js` | Page, styling, and controls |
| `model.js` | Cache behavior and address decoding |
| `data.js` | Bundled trace inputs and measured Verilog results |
| `tools/prepare.py`, `tools/test.js` | Refresh the bundle and compare the model to the hardware events |

After changing hardware or a trace, run `./run.sh compare` and then
`./run.sh web-test` from the project root.
