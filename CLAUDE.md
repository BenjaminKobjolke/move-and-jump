# Version
2

# Coding Rules (Pointer)

This project's rules live in two files in the project root:

- `CODING_RULES.md` — code quality and conventions. BINDING for all code work in
  this repository, always.
- `IMPLEMENTATION_FLOW.md` — the end-to-end flow to follow when planning and
  implementing a change (checks, gates, Definition of Done).

MANDATORY: Before writing or editing ANY code, you MUST Read BOTH files in full
**in the current session**. Do not rely on memory of a previous session, a
summary, or partial reads.

If you are about to make a code change and have not read both files in this
session: STOP, read them, then continue.

An external tool may orchestrate the implementation itself. When a skill or run
states that the implementation is orchestrated, ignore `IMPLEMENTATION_FLOW.md`
entirely — the orchestrator runs those steps as its own phases. `CODING_RULES.md`
stays binding either way.

Do not inline rules back into this file and do not use `@import` for either file —
they are intentionally referenced, not imported.


This project's graphify code directory is the repo root (.); non-code files are excluded by .graphifyignore.

## Post-Implementation Code Analysis

After any feature, finished plan, or bug fix, run the changed-files analyzer and fix issues it reports:

```powershell
cd 'D:\GIT\BenjaminKobjolke\thunderbird\move-and-jump'
cmd /c '.\tools\analyze_changed_and_new_files.bat'
```

The changed-files run uses `--only-changed`, including new and modified source files while skipping deleted files. Run `tools\analyze_code.bat` for a whole-project audit, before a release or merge, after shared-code refactors, or when the working tree has no changed source files. Analyzer reports are written as per-rule CSV files under `code_analysis_results\`; a missing CSV means that rule found no issues.
