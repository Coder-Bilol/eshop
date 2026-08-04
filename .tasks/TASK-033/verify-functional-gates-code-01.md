# TASK-033 Independent Functional Gates Code 01

| Check | Result |
|---|---|
| Required packet R2 ready/hash-matched before verification | PASS |
| Real Auth/Customer PostgreSQL write/fresh-read/cleanup | PASS |
| First/repeat login and collision/missing-email real paths | PASS |
| Local provider negative/security contracts | PASS |
| Real HTTP session cookie creation/destruction | FAIL - not exercised |
| Old cookie rejected after fresh backend process | FAIL - not exercised |
| Backend typecheck | PASS |
| Windows-native local smoke | PASS |
| Memory Bank lint and strict doctor | PASS |
| Scope/privacy/cleanup audit | PASS |
| `git diff --check` | PASS with line-ending warnings only |

The acceptance output claim `cookie-save-destroy-and-restart-loss-covered` is based
on an in-memory session recorder, configuration assertions, and absence of session
field names in persisted Auth/Customer JSON. It is not runtime cookie/restart proof.

VERDICT: FAIL

HUMAN_CHECKPOINT: done
ROLLBACK_RECOVERY_NOTE: present
