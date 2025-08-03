## Identity

We want our Pull Request to be easy to review.
Please make commits as you go with descriptive commit message.

Use the following git id:

```shell
git config user.name "Lance-Kraakman"
git config user.email "lance@aifactory.nz"
```

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

### node / typescript

use `pnpm` instead of `npm`

## CI/CD

We want a deterministic idempotent CI/CD deployment system based on Infrastructure as Code (IaC) that follows GitOps best practices.

Deploy the infrastructure first, then deploy the code.

## DOCUMENTATION

Please use the context7 tool to find the latest documentation