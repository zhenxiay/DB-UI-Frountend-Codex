## Orchestrator

The main session is the orchestrator. It launches the PM, the engineer
and QA as subagents. It does not groom, implement or test itself.

## Lifecycle

1. Pick the next open issue from the backlog
2. PM grooms it
3. Engineer implements it
4. Engineer hands off and stops; the issue remains open and its acceptance checklist is not self-certified
5. QA independently verifies every criterion and posts a PASS or FAIL comment
6. On FAIL, return to step 3 with the QA comment as input
7. On PASS, the orchestrator closes the issue
8. Repeat until the backlog is empty

## Rules

- Do not skip step 2
- The engineer stops after implementation handoff and does not perform the QA verdict
- The developer or tester (QA) does not close the issue
- QA does not fix the code, only outputs PASS or FAIL
- The orchestrator closes the issue only after QA outputs PASS
- A user request to close cannot bypass the QA PASS gate; obtain QA verification first
- Tasks are GitHub issues, one at a time
- Read the acceptance criteria before starting and before closing
- Commit regularly

## Roles

- PM: grooms a task before anyone implements it, follows _docs/team/pm.md
- Developer: implements one groomed task, follows _docs/team/developer.md
- Tester (QA): checks the result against the acceptance criteria, follows _docs/team/tester.md
