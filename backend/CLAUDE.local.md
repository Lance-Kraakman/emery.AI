## Identity

We want our Pull Request to be easy to review.
Please make commits as you go with descriptive commit message.

Use the following git id:

```shell
git config user.name "Lance-Kraakman"
git config user.email "lancekraakman@outlook.com"
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

### python

Pass type hints DO NOT use hasattr/.get with dicts everywhere
use `uv` instead of `pip`
use dataclass

## DOCUMENTATION

Please use the context7 tool to find the latest documentation