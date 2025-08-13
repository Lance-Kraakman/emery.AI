## Identity

We want our Pull Request to be easy to review.
Please make commits as you go with descriptive commit message.

Use the following git id:

```shell
git config user.name "Lance-Kraakman"
git config user.email "lance@aifactory.nz"
```

### NEXTJS Rules

Use Server Actions when:
- You're using the App Router.
- The action is internal-only (not called externally).
- You want type-safe, co-located DB logic (e.g., Drizzle).
- You don’t need custom HTTP headers/status codes.
- You're handling form submissions or component-triggered mutations.

Use API Routes when:
- You need to expose an HTTP endpoint (e.g., to mobile clients or webhooks).
- You require custom HTTP responses (headers, status, etc.).
- The action is called via fetch or by external services.
- You need to test or call it independently (e.g., via Postman).
- You're using the Pages Router, or need full control over request/response.

Use Server Components when:

- You don't need interactivity (no event listeners).
- You want to fetch data on the server (e.g., DB queries).
- You want better performance and smaller bundles.
- You’re using Server Actions, file system, or sensitive logic.
- Component is static or rendered once on request.

Use Client Components when:

- You need interactivity (e.g., onClick, useState, useEffect).
- You’re using browser-only APIs (e.g., localStorage, window).
- You use context/state that updates on the client.
- Component relies on real-time updates, sockets, or animations.
- You’re handling forms with client-side validation.

### git

Please make descriptive git commits at reasonable intervals. DO NOT add comments that include Claude Code as a collaborator.

#### Pre-commit Testing Protocol

**MANDATORY**: Always run tests before committing to ensure changes don't break existing functionality.

```bash
# Quick smoke test (no external dependencies)
uv run python quick_test.py

# If quick tests pass, run full test suite
uv run python run_tests.py all

# For Python projects specifically:
uv run pytest tests/ -v

# If any tests fail:
# 1. Fix the issues immediately
# 2. Re-run tests to verify fixes
# 3. Only commit when all tests pass
```

**Test-Driven Commit Process:**
1. Make your code changes
2. Run `uv run python quick_test.py` 
3. If successful, run `uv run python run_tests.py all`
4. Fix any failing tests before proceeding
5. Commit only when all tests pass
6. Include test status in commit message if relevant

**Failed Test Protocol:**
- Never commit with failing tests
- If tests fail due to environmental issues (missing tokens, etc.), document clearly
- Create separate commits for test fixes vs. feature changes
- Update tests when changing functionality, don't ignore test failures

### testing

Please add meaningful unit tests where appropriate. We want to avoid stubbing and mocking EVERYTHING just to get code coverage. We want our test suite to be effective, elegnat, simple, and meaningfull.

### Anchor comments

  Add specially formatted comments throughout the codebase, where appropriate, for yourself as inline knowledge that can be easily `grep`ped for.

  - Use `AIDEV-NOTE:`, `AIDEV-TODO:`, or `AIDEV-QUESTION:` as prefix as appropriate.

  - *Important:* Before scanning files, always first try to grep for existing `AIDEV-…`.

  - Update relevant anchors, after finishing any task.

  - Make sure to add relevant anchor comments, whenever a file or piece of code is:

  * too complex, or
  * very important, or
  * could have a bug

# Do not write backwards-compatible software

Do not write backwards-compatible software unless specified

### python

use `uv` instead of `pip`

#### Python Code Quality Standards

**Imports:**
- All imports must be at the top of the file - NO inline imports  
- Group imports: stdlib, third-party, local imports
- Fail fast on missing dependencies - don't use graceful fallbacks unless truly optional
- If dependency is required, import directly and let ImportError fail the module load
- Example:
  ```python
  from required_library import RequiredClass
  from dotenv import load_dotenv  # Will fail if not installed - good!
  ```

**Type Hints:**
- Prefer TypedDict over Dict[str, Any] for structured data
- Use Union types over generic Any when possible
- Create domain-specific type aliases for better clarity
- Example:
  ```python
  from typing import TypedDict
  
  class ExecutionResult(TypedDict, total=False):
      status: str
      result: Optional[Any]
      error: Optional[str]
  ```

**Error Handling:**
- Avoid over-defensive patterns like excessive `.get(key, default)` usage
- Use `obj.get(key) or default` instead of `obj.get(key, default)` for non-None defaults
- Replace `hasattr(obj, 'attr')` with `getattr(obj, 'attr', None)` where appropriate
- Use proper exception handling rather than defensive programming

**Function Design:**
- Keep functions under 50 lines when possible
- Extract complex logic into helper methods
- Use descriptive parameter names and return types
- Single responsibility principle - one function, one purpose

**Documentation:**
- Use AIDEV-NOTE, AIDEV-TODO, AIDEV-QUESTION comments for searchable inline docs
- Write concise docstrings focusing on purpose, not implementation
- Document complex business logic and architectural decisions

**Testing:**
- Focus on integration testing over unit testing with excessive mocking
- Test actual behavior, not implementation details
- Use `uv run pytest` for all test execution
- Organize tests by functionality, not by file structure

**Code Structure:**
- Extract constants for magic numbers (MAX_LOG_PREVIEW_LENGTH = 100)
- Split large files (>300 lines) into focused modules
- One class per file when possible, related classes can be grouped
- Use specific exception types instead of generic `Exception`
- Chain exceptions with `raise ... from e` to preserve stack traces

**Return Values:**
- Use TypedDict for structured return values instead of Dict[str, Any]
- Create domain-specific types (CapabilityExecutionResult, OrchestratorResult)
- Avoid defensive `.get()` calls on known structures
- Make return types explicit and consistent

**Anti-patterns to Avoid:**
- Generic `except Exception as e:` without re-raising or logging context
- Magic numbers scattered throughout code
- Defensive `.get()` usage on typed structures
- Files with multiple unrelated classes (>4 classes per file)
- Hard-coded paths and URLs
- String concatenation for paths (use pathlib)

### node / typescript

use `pnpm` instead of `npm`

## CI/CD

We want a deterministic idempotent CI/CD deployment system based on Infrastructure as Code (IaC) that follows GitOps best practices.

Deploy the infrastructure first, then deploy the code.

## DOCUMENTATION

Please use the context7 tool to find the latest documentation