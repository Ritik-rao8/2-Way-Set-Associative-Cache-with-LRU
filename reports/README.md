# IEEE Project Report (Phase I)

This directory contains the IEEE-formatted report for **Phase I: Prototype & Verification**:

- **Primary Deliverable**: [📄 `phase-i.pdf`](phase-i.pdf) — Complete IEEE report covering the prototype design, literature review, proposed solution, and 5-member individual contributions.
- **Source File**: `phase-i.tex` (IEEEtran format).
- **Authors & Affiliations**: `authors.tex` (configured for all 5 team members).
- **Citations & Bibliography**: `references.tex`.

---

## Rebuilding the Report PDF

If you make any updates to `phase-i.tex` or `authors.tex`, recompile the PDF using [Tectonic](https://tectonic-typesetting.github.io/) or `pdflatex`:

```bash
cd reports
tectonic phase-i.tex
```

Or using standard `pdflatex`:
```bash
pdflatex phase-i.tex
bibtex phase-i
pdflatex phase-i.tex
pdflatex phase-i.tex
```
