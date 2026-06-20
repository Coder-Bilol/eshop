---
description: Реестр доступных скиллов (когда применять) в этом репозитории.
status: active
---
# Skills

## Installed
- cold-start

## When to use
- Bootstrap: cold-start / mb-init
- Optional Analysis: mb-analysis, then /analysis /brainstorm /brief when the idea is not ready for PRD
- Project principles: /constitution after /brief or existing PRD context, before /write-prd only when project_principles is not ratified|partial
- PRD → MB: /write-prd, lightweight /spec-init, /prd, /spec-design, then /prd-to-tasks
- SDD design: /spec-init for lightweight route-map preflight, /spec-design for mandatory adaptive global backbone after /prd, /prd-to-tasks for feature-level SDD plus task slicing, /spec-improve FT-XXX for repair/refresh, /spec-auto for autonomous design
- Map codebase: /map-codebase
- Execution: /execute
- Verification (UAT): /verify
- Semantic adversarial verification: /red-verify
- Autonomous run: autonomous / autopilot
- Readiness doctor: mb-doctor
- Review: /review
- Maintenance: mb-garden
- Harness: mb-harness
