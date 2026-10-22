---
"@enkaku/client": patch
"@enkaku/http-fetch": patch
---

Settle aborted calls before send completes; add http-fetch cancelOnAbort; cancel POSTs on dispose; isolate abort POST failures

Calls aborted before their messages are sent are no longer written, so their handlers never run.
Falsy params (`0`, `''`, `false`) are now sent.
An unhandled request rejection no longer raises `unhandledRejection`, because the call promise is the controller result.
