# TASK-033 Session HTTP Remediation Gates Code 02

| Check | Result |
|---|---|
| Real `POST /auth/session` returns actual session Set-Cookie | PASS |
| Cookie flags and configured CORS | PASS |
| Cookie authenticates real `/store/customers/me` | PASS |
| Real logout succeeds and prior cookie is rejected | PASS |
| New cookie works before restart | PASS |
| Pre-restart cookie is rejected after full backend restart | PASS |
| Durable Auth/Customer link survives restart/fresh process | PASS |
| Temporary API key and auth/customer fixtures are removed | PASS |
| Private temp state file removed | PASS |
| Output contains only coarse session summary | PASS |
| Backend typecheck | PASS |
| Windows-native local smoke | PASS |
| Memory Bank lint and strict doctor | PASS |
| CommonJS syntax and diff checks | PASS |
| Evidence sensitive-value scan | PASS |

The command stores no cookie, bearer, publishable key, fixture ID, customer email,
session ID, raw IP, provider token, or secret in this artifact.
