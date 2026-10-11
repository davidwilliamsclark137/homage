# Provenance and attribution

Extracted by copying Homage's `sky/engine`, `sky/starCatalog.ts` and `sky/hipparcos.naked-eye.json` on 2026-09-22. Original working-tree hashes and source Git HEAD are recorded in `provenance/source-manifest.json` in this repository. Original engine README retained there. Local changes are described in `docs/AUDIT.md`.

Astronomy Engine 2.1.19: Copyright © 2019–2023 Donald Cross, MIT license; license text retained in `ASTRONOMY-ENGINE-LICENSE.txt`. Runtime dependency remains a package dependency, not relabeled source.

Hipparcos Main Catalogue I/239/hip_main, ESA 1997 via CDS VizieR. Source/query/generatedAt metadata is preserved byte-for-byte in the original catalog JSON. Retained builder: `scripts/build-star-catalog.mjs`; source fields HIP,Vmag,Hpmag,RAICRS,DEICRS,B-V, limiting magnitude 6.5. Original TSV is not available in this extraction. Named constellation patterns/coordinates are inherited from Homage; no additional source attribution was present in those files.

Homage-derived code has no explicit standalone redistribution license supplied here. Packages remain private and UNLICENSED; this does not replace or grant third-party rights. Preserve this notice and upstream metadata in later internal artifacts.
