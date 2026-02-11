"""
Planning patterns for filesystem operations.

Patterns for exploring, reading, searching, and modifying files in the agent's
workspace using Claude Code-style filesystem tools.
"""

from emery_agents.planning.pattern import AutoApprovePolicy, PlanningPattern

FILESYSTEM_EXPLORATION_PATTERN = PlanningPattern(
    id="plan:filesystem_exploration",
    name="Filesystem Exploration",
    description="Planning patterns for discovering and exploring files in the workspace. "
    "Use for understanding project structure, finding files, and searching code.",
    triggers=[
        "explore files",
        "what files",
        "list files",
        "find file",
        "search files",
        "project structure",
        "show files",
        "what's in",
        "directory",
        "codebase",
    ],
    capability_ids=["agent:executor"],
    strategy="""
DISCOVERY-FIRST APPROACH:
1. Start with glob to find files by pattern
2. Use grep to search content across files
3. Use read_file to examine specific files
4. NEVER modify files you haven't read first

TOOL SELECTION:
- Need file LIST? → glob("**/*.py")
- Need file CONTENTS? → read_file("path/to/file")
- Need to FIND something? → grep("pattern")

EXPLORATION PATTERNS:
- Project structure: glob("**/*") or bash("tree -L 2")
- Find definition: grep("def function_name|class ClassName")
- Find usage: grep("function_name\\(")
- Find config: glob("**/config*") or glob("**/*.json")
""",
    tool_sequence=["glob", "grep", "read_file"],
    step_templates=[
        "Discover files matching pattern '[pattern]' using glob. Verify: file list returned.",
        "Search for '[term]' across [scope] using grep. Verify: matches found or confirmed absent.",
        "Read file '[path]' to understand its structure. Verify: content retrieved.",
        "Explore directory structure using tree -L [depth]. Verify: structure visible.",
    ],
    examples=[
        {
            "request": "What Python files are in this project?",
            "plan_steps": [
                "Discover files matching pattern '**/*.py' using glob. Verify: file list returned.",
            ],
        },
        {
            "request": "Where is the main function defined?",
            "plan_steps": [
                "Search for 'def main' across workspace using grep. Verify: matches found.",
                "Read file with main function to understand its structure. Verify: content retrieved.",
            ],
        },
        {
            "request": "Show me the project structure",
            "plan_steps": [
                "Explore directory structure using tree -L 2. Verify: structure visible.",
            ],
        },
    ],
    common_mistakes=[
        "Using bash cat instead of read_file",
        "Guessing file paths without using glob first",
        "Searching contents when only listing is needed",
    ],
    auto_approve_policy=AutoApprovePolicy.AUTO,
    auto_approve_conditions=["read_only"],
)


FILESYSTEM_READ_PATTERN = PlanningPattern(
    id="plan:filesystem_read",
    name="File Reading",
    description="Planning patterns for reading and examining file contents. "
    "Use read_file for viewing specific files with line numbers.",
    triggers=[
        "read file",
        "show file",
        "view file",
        "cat file",
        "open file",
        "what's in",
        "contents of",
        "look at",
        "examine",
    ],
    capability_ids=["agent:executor"],
    strategy="""
FILE READING:
1. Use read_file for known file paths
2. Specify start_line and max_lines for large files
3. Line numbers are included in output (1-indexed)

LARGE FILE HANDLING:
- Default reads up to 200 lines
- For large files: read_file("path", start_line=50, max_lines=100)
- Find relevant sections first with grep, then read those lines

BEST PRACTICES:
- Always verify file exists with glob if path uncertain
- Use grep to find relevant line numbers first
- Don't read entire large files - be selective
""",
    tool_sequence=["read_file"],
    step_templates=[
        "Read file '[path]' to examine its contents. Verify: content displayed.",
        "Read lines [start]-[end] of '[path]' to examine specific section. Verify: section displayed.",
    ],
    examples=[
        {
            "request": "Show me the config.json file",
            "plan_steps": [
                "Read file 'config.json' to examine its contents. Verify: content displayed.",
            ],
        },
        {
            "request": "What's in line 50-100 of main.py?",
            "plan_steps": [
                "Read lines 50-100 of 'main.py' to examine specific section. Verify: section displayed.",
            ],
        },
    ],
    common_mistakes=[
        "Reading entire large files without limits",
        "Using bash cat instead of read_file",
        "Not finding file path first with glob",
    ],
    auto_approve_policy=AutoApprovePolicy.AUTO,
    auto_approve_conditions=["read_only", "single_file"],
)


FILESYSTEM_WRITE_PATTERN = PlanningPattern(
    id="plan:filesystem_write",
    name="File Writing",
    description="Planning patterns for creating new files or completely replacing file contents. "
    "Use write_file for new files, edit_file for modifications.",
    triggers=[
        "create file",
        "write file",
        "new file",
        "save file",
        "make file",
        "generate file",
    ],
    capability_ids=["agent:executor"],
    strategy="""
FILE CREATION:
1. Determine if file exists (use glob or read_file)
2. If new file: use write_file
3. If modifying existing: use edit_file instead
4. Directories are created automatically

WHEN TO USE write_file:
- Creating brand new files
- Completely replacing file contents
- Generating new code or config files

WHEN NOT TO USE (use edit_file instead):
- Making small changes to existing files
- Adding or modifying specific sections
- Bug fixes or updates

BEST PRACTICES:
- Check if file exists before overwriting
- Use edit_file for modifications to preserve existing content
- Include all necessary content (imports, etc.)
""",
    tool_sequence=["write_file"],
    step_templates=[
        "Create file '[path]' with [description of content]. Verify: file created.",
        "Generate '[filename]' containing [content description]. Verify: file exists.",
    ],
    examples=[
        {
            "request": "Create a new config.json file",
            "plan_steps": [
                "Create file 'config.json' with default configuration values. Verify: file created.",
            ],
        },
        {
            "request": "Generate a Python hello world script",
            "plan_steps": [
                "Create file 'hello.py' with hello world function. Verify: file created.",
            ],
        },
    ],
    common_mistakes=[
        "Overwriting important files without checking",
        "Using write_file for small edits (use edit_file)",
        "Not including all necessary content (missing imports)",
        "Forgetting to verify file creation",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_file", "explicit_values"],
)


FILESYSTEM_EDIT_PATTERN = PlanningPattern(
    id="plan:filesystem_edit",
    name="File Editing",
    description="Planning patterns for making targeted changes to existing files. "
    "Use edit_file for modifications, requires reading file first.",
    triggers=[
        "edit file",
        "modify file",
        "change file",
        "update file",
        "fix file",
        "add to file",
        "insert",
        "replace",
        "rename function",
        "refactor",
    ],
    capability_ids=["agent:executor"],
    strategy="""
FILE EDITING:
1. ALWAYS read_file first to get exact content
2. Use edit_file with exact old_content (including whitespace)
3. Verify the change was made

EDIT WORKFLOW:
1. read_file to see current content with line numbers
2. Identify the exact text to change (copy from read output)
3. edit_file with old_content and new_content
4. Optionally read_file again to verify

CRITICAL:
- old_content must match EXACTLY (whitespace matters)
- Include enough context to make the match unique
- If edit fails, re-read the file and try again

BEST PRACTICES:
- For multi-line edits, include surrounding lines for uniqueness
- Don't guess content - always read first
- One logical change per edit for easier verification
""",
    tool_sequence=["read_file", "edit_file"],
    step_templates=[
        "Read file '[path]' to understand current content. Verify: content retrieved.",
        "Edit '[path]' to [change description]. Verify: change applied.",
        "Modify '[path]' by replacing [old] with [new]. Verify: file updated.",
    ],
    examples=[
        {
            "request": "Fix the bug in calculate function",
            "plan_steps": [
                "Read file 'calc.py' to understand current content. Verify: content retrieved.",
                "Edit 'calc.py' to fix the bug in calculate function. Verify: change applied.",
            ],
        },
        {
            "request": "Rename function old_name to new_name",
            "plan_steps": [
                "Read file containing old_name to get exact content. Verify: content retrieved.",
                "Edit file to rename 'old_name' to 'new_name'. Verify: function renamed.",
            ],
        },
    ],
    common_mistakes=[
        "Editing without reading file first",
        "old_content doesn't match exactly (whitespace)",
        "Not including enough context for unique match",
        "Making too many changes at once",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_file", "explicit_values"],
)


FILESYSTEM_SEARCH_PATTERN = PlanningPattern(
    id="plan:filesystem_search",
    name="Content Search",
    description="Planning patterns for searching file contents across the workspace. "
    "Use grep for finding patterns, definitions, and usage across files.",
    triggers=[
        "search for",
        "find where",
        "where is",
        "grep",
        "look for",
        "what uses",
        "who calls",
        "definition of",
        "occurrences of",
    ],
    capability_ids=["agent:executor"],
    strategy="""
CONTENT SEARCH:
1. Use grep for searching across files
2. Filter by file type with file_pattern
3. Add context lines to understand matches

GREP PATTERNS:
- Exact word: \\bword\\b
- Function def: "def function_name"
- Class def: "class ClassName"
- Imports: "import.*module" or "from module"
- Usage: "function_name\\("

OPTIONS:
- file_pattern="*.py" - filter to Python files
- context=2 - show 2 lines before/after match
- max_results=50 - limit results

BEST PRACTICES:
- Use regex anchors for precision
- Filter by file type when possible
- Read full file after finding match for context
""",
    tool_sequence=["grep", "read_file"],
    step_templates=[
        "Search for '[pattern]' across [scope] using grep. Verify: matches found.",
        "Find all occurrences of '[term]' in [file_pattern] files. Verify: results returned.",
        "Locate definition of '[name]' using grep. Verify: definition found.",
    ],
    examples=[
        {
            "request": "Where is process_data defined?",
            "plan_steps": [
                "Search for 'def process_data' across workspace using grep. Verify: matches found.",
                "Read file containing definition to understand implementation. Verify: content retrieved.",
            ],
        },
        {
            "request": "Find all TODO comments",
            "plan_steps": [
                "Search for 'TODO' across workspace using grep with context=1. Verify: matches found.",
            ],
        },
        {
            "request": "What files import pandas?",
            "plan_steps": [
                "Search for 'import.*pandas|from pandas' in *.py files. Verify: matches found.",
            ],
        },
    ],
    common_mistakes=[
        "Too broad patterns matching unwanted content",
        "Not filtering by file type",
        "Not reading file after finding match",
    ],
    auto_approve_policy=AutoApprovePolicy.AUTO,
    auto_approve_conditions=["read_only"],
)


BASH_EXECUTION_PATTERN = PlanningPattern(
    id="plan:bash_execution",
    name="Bash Command Execution",
    description="Planning patterns for running bash commands, scripts, and system operations. "
    "Use for build tools, installations, and complex pipelines.",
    triggers=[
        "run command",
        "execute",
        "bash",
        "shell",
        "install",
        "build",
        "compile",
        "npm",
        "pip",
        "make",
        "script",
    ],
    capability_ids=["agent:executor"],
    strategy="""
BASH EXECUTION:
1. Prefer specialized tools (read_file, glob, grep) for simple operations
2. Use bash for system commands, builds, and pipelines
3. Commands run in /workspace directory

WHEN TO USE BASH:
- Running build tools (npm, pip, make)
- Installing dependencies
- Running scripts
- Complex pipelines combining multiple tools
- System operations

WHEN NOT TO USE:
- Simple file reading (use read_file)
- File search (use glob/grep)
- File writing (use write_file)

AVAILABLE IN SANDBOX:
- Build: npm, pip, make, python, node
- Data: jq, awk, sed, sort, uniq
- Network (if enabled): curl, wget

BEST PRACTICES:
- Use full paths from /workspace/
- Quote paths with spaces
- Chain with && for dependent commands
- Check results before destructive operations
""",
    tool_sequence=["bash"],
    step_templates=[
        "Run '[command]' to [purpose]. Verify: command succeeds.",
        "Install dependencies with '[command]'. Verify: packages installed.",
        "Build project using '[command]'. Verify: build succeeds.",
        "Execute script '[script]'. Verify: script completes.",
    ],
    examples=[
        {
            "request": "Install the Python dependencies",
            "plan_steps": [
                "Run 'pip install -r requirements.txt' to install dependencies. Verify: packages installed.",
            ],
        },
        {
            "request": "Run the tests",
            "plan_steps": [
                "Run 'pytest' to execute test suite. Verify: tests complete.",
            ],
        },
        {
            "request": "Build the project",
            "plan_steps": [
                "Run 'npm run build' to compile project. Verify: build succeeds.",
            ],
        },
    ],
    common_mistakes=[
        "Using bash for simple file reading",
        "Not using full paths",
        "Running destructive commands without verification",
        "Not checking command exit status",
    ],
    auto_approve_policy=AutoApprovePolicy.CONFIRM,
    auto_approve_conditions=["single_command"],
)


# Export all filesystem-related patterns
FILESYSTEM_PATTERNS = [
    FILESYSTEM_EXPLORATION_PATTERN,
    FILESYSTEM_READ_PATTERN,
    FILESYSTEM_WRITE_PATTERN,
    FILESYSTEM_EDIT_PATTERN,
    FILESYSTEM_SEARCH_PATTERN,
    BASH_EXECUTION_PATTERN,
]
