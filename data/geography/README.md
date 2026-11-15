# Academic PGA reference grid

Source: [Jeodezik Deprem Tehlike Haritası](https://aperta.ulakbim.gov.tr/records/274290), v1, 2025-02-16, Aktuğ et al.

License: **CC-BY-SA-4.0**. `pga.csv.gz` is a lossless gzip copy of the publisher file `PGA_0.10_50yrs.csv`.
Publisher MD5: `62c2c510f923d8cc68b2207fcb62c6da`, checked against the live record API on 2026-11-08.
The application checks the decompressed file before using it. Authors and source metadata are in `metadata.json`.

PGA is in g; the companion publisher map labels PGA (g). File label: 10% probability of exceedance in 50 years.
Use the nearest published point only within 5 km, with its actual distance. No interpolation or extrapolation.
This is an academic model, **not the official AFAD TDTH grid and not a building safety assessment**.
The existing `hazard_distribution.json` supplies the prototype comparison percentile.
