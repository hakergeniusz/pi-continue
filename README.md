# pi-continue

One command, one job: pick the task back up.

```
/continue            resume the previous run where it left off
/continue <text>     resume, with an extra instruction
```

The agent's transcript already holds everything — what it did, what it
learned, what is still open. So "continue" repeats none of that; it sends one
nudge ("resume from exactly where you left off, don't redo finished work")
through pi's `sendUserMessage`, which always triggers a turn.

Details:

- `/continue` before any agent run in the session refuses politely instead of
  sending the agent into a void.
- While the agent is still streaming, the message is queued as a **follow-up**
  rather than steering mid-thought, and the notification says so.
- Anything typed after the command is passed along as an extra instruction, so
  `/continue run the tests first` reads naturally.

## Install

```bash
pi install /path/to/pi-continue
# or, once pushed:
pi install git:github.com/hakergeniusz/pi-continue
```

## Verify

```bash
bun test.ts        # 10 assertions, no network
bun x tsc --noEmit # strict, against the real 0.87.1 types
```

MIT licensed.
