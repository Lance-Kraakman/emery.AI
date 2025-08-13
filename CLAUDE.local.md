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
- Use graceful fallback for optional dependencies:
  ```python
  try:
      from optional_library import SomeClass
  except ImportError:
      SomeClass = None
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

### node / typescript

use `pnpm` instead of `npm`

## CI/CD

We want a deterministic idempotent CI/CD deployment system based on Infrastructure as Code (IaC) that follows GitOps best practices.

Deploy the infrastructure first, then deploy the code.

## DOCUMENTATION

Please use the context7 tool to find the latest documentation