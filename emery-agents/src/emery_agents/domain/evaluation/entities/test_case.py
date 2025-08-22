"""
Test Case Entities

AIDEV-NOTE: Simplified test case structure for table-driven testing.
Clear input/expected output pattern similar to Go testing.
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union
from enum import Enum


@dataclass
class TestInput:
    """Clear test input specification."""
    instructions: str
    context: Dict[str, Any] = None
    tools: List[str] = None
    expected_step_type: str = None  # "CODE_STEP" or "TOOL_STEP"
    
    def __post_init__(self):
        if self.context is None:
            self.context = {}
        if self.tools is None:
            self.tools = []


@dataclass
class ExpectedResult:
    """Clear expected result specification."""
    should_succeed: bool
    should_generate_code: bool = False
    should_call_tools: List[str] = None
    should_contain: List[str] = None  # Patterns that should be in output
    should_have_variables: List[str] = None  # Variables that should be created
    execution_time_max_ms: Optional[int] = None
    
    def __post_init__(self):
        if self.should_call_tools is None:
            self.should_call_tools = []
        if self.should_contain is None:
            self.should_contain = []
        if self.should_have_variables is None:
            self.should_have_variables = []


@dataclass
class ActualResult:
    """Actual execution result for comparison."""
    succeeded: bool
    execution_time_ms: int
    generated_code: Optional[str] = None
    called_tools: List[str] = None
    created_variables: List[str] = None
    output_text: str = ""
    error_message: Optional[str] = None
    
    def __post_init__(self):
        if self.called_tools is None:
            self.called_tools = []
        if self.created_variables is None:
            self.created_variables = []


@dataclass
class TestCase:
    """Single test case with clear input/expected/actual pattern."""
    name: str
    description: str
    input: TestInput
    expected: ExpectedResult
    actual: Optional[ActualResult] = None
    passed: Optional[bool] = None
    failure_reason: Optional[str] = None


@dataclass
class TestSuite:
    """Collection of test cases for a capability or agent."""
    name: str
    description: str
    test_cases: List[TestCase]
    
    @property
    def total_tests(self) -> int:
        return len(self.test_cases)
    
    @property
    def passed_tests(self) -> int:
        return sum(1 for tc in self.test_cases if tc.passed is True)
    
    @property
    def failed_tests(self) -> int:
        return sum(1 for tc in self.test_cases if tc.passed is False)
    
    @property
    def success_rate(self) -> float:
        if self.total_tests == 0:
            return 0.0
        return (self.passed_tests / self.total_tests) * 100


# Pre-defined test suites for common capabilities
EMAIL_TEST_CASES = [
    TestCase(
        name="simple_email_compose",
        description="Compose a simple email with recipient, subject, and body",
        input=TestInput(
            instructions="Compose an email to test@example.com with subject 'Test' and body 'Hello World'",
            context={"recipient": "test@example.com", "subject": "Test", "body": "Hello World"},
            expected_step_type="CODE_STEP"
        ),
        expected=ExpectedResult(
            should_succeed=True,
            should_generate_code=True,
            should_have_variables=["email_data", "recipient", "subject", "body"],
            should_contain=["test@example.com", "Test", "Hello World"]
        )
    ),
    TestCase(
        name="send_email_via_gmail",
        description="Send email using Gmail API tool",
        input=TestInput(
            instructions="Send the composed email using Gmail API",
            context={"email_composed": True},
            tools=["gmail_send"],
            expected_step_type="TOOL_STEP"
        ),
        expected=ExpectedResult(
            should_succeed=True,
            should_generate_code=False,
            should_call_tools=["gmail_send"],
            should_contain=["message_id", "sent"]
        )
    ),
    TestCase(
        name="email_with_attachment",
        description="Send email with file attachment",
        input=TestInput(
            instructions="Send email with PDF attachment from /tmp/document.pdf",
            context={"has_attachment": True, "file_path": "/tmp/document.pdf"},
            tools=["gmail_send"],
            expected_step_type="TOOL_STEP"
        ),
        expected=ExpectedResult(
            should_succeed=True,
            should_generate_code=False,
            should_call_tools=["gmail_send"],
            should_contain=["attachment", "pdf"],
            execution_time_max_ms=30000
        )
    )
]

DATA_ANALYSIS_TEST_CASES = [
    TestCase(
        name="load_csv_data",
        description="Load CSV data and create DataFrame",
        input=TestInput(
            instructions="Load the provided CSV data into a pandas DataFrame",
            context={"csv_data": [{"name": "Alice", "age": 25}, {"name": "Bob", "age": 30}]},
            expected_step_type="CODE_STEP"
        ),
        expected=ExpectedResult(
            should_succeed=True,
            should_generate_code=True,
            should_have_variables=["df", "data"],
            should_contain=["pandas", "DataFrame", "csv"]
        )
    ),
    TestCase(
        name="calculate_statistics",
        description="Calculate descriptive statistics on the data",
        input=TestInput(
            instructions="Calculate mean, median, and standard deviation for the age column",
            context={"data_loaded": True},
            expected_step_type="CODE_STEP"
        ),
        expected=ExpectedResult(
            should_succeed=True,
            should_generate_code=True,
            should_have_variables=["stats", "mean", "median"],
            should_contain=["mean", "median", "std", "age"]
        )
    ),
    TestCase(
        name="generate_visualization",
        description="Create a chart from the data",
        input=TestInput(
            instructions="Create a bar chart showing the age distribution",
            context={"stats_calculated": True},
            expected_step_type="CODE_STEP"
        ),
        expected=ExpectedResult(
            should_succeed=True,
            should_generate_code=True,
            should_have_variables=["plot", "chart"],
            should_contain=["matplotlib", "pyplot", "bar", "chart"]
        )
    )
]

WEB_SEARCH_TEST_CASES = [
    TestCase(
        name="basic_web_search",
        description="Perform basic web search query",
        input=TestInput(
            instructions="Search for 'Python best practices' and return top 5 results",
            context={"query": "Python best practices", "max_results": 5},
            tools=["web_search"],
            expected_step_type="TOOL_STEP"
        ),
        expected=ExpectedResult(
            should_succeed=True,
            should_generate_code=False,
            should_call_tools=["web_search"],
            should_contain=["results", "Python", "title", "url"]
        )
    ),
    TestCase(
        name="filter_search_results",
        description="Filter search results by domain",
        input=TestInput(
            instructions="Filter search results to only show results from github.com and stackoverflow.com",
            context={"search_performed": True, "filter_domains": ["github.com", "stackoverflow.com"]},
            expected_step_type="CODE_STEP"
        ),
        expected=ExpectedResult(
            should_succeed=True,
            should_generate_code=True,
            should_have_variables=["filtered_results", "domain_filter"],
            should_contain=["github.com", "stackoverflow.com", "filter"]
        )
    )
]


def get_test_suite(capability_name: str) -> Optional[TestSuite]:
    """Get predefined test suite for a capability."""
    test_suites = {
        "email": TestSuite("Email Capability Tests", "Test suite for email sending capabilities", EMAIL_TEST_CASES),
        "send_email": TestSuite("Email Capability Tests", "Test suite for email sending capabilities", EMAIL_TEST_CASES),
        "data_analysis": TestSuite("Data Analysis Tests", "Test suite for data analysis capabilities", DATA_ANALYSIS_TEST_CASES),
        "csv_data_analysis": TestSuite("Data Analysis Tests", "Test suite for data analysis capabilities", DATA_ANALYSIS_TEST_CASES),
        "web_search": TestSuite("Web Search Tests", "Test suite for web search capabilities", WEB_SEARCH_TEST_CASES),
    }
    return test_suites.get(capability_name.lower())


def create_custom_test_case(
    name: str,
    description: str,
    instructions: str,
    should_succeed: bool = True,
    should_generate_code: bool = False,
    should_call_tools: List[str] = None,
    context: Dict[str, Any] = None,
    **kwargs
) -> TestCase:
    """Helper function to create custom test cases easily."""
    
    # Extract expected parameters and map them properly
    expected_params = {}
    for key, value in kwargs.items():
        if key.startswith('expected_'):
            # Remove 'expected_' prefix and map to correct parameter names
            clean_key = key.replace('expected_', '')
            if clean_key == 'should_contain':
                expected_params['should_contain'] = value
            elif clean_key == 'should_have_variables':
                expected_params['should_have_variables'] = value
            elif clean_key == 'execution_time_max_ms':
                expected_params['execution_time_max_ms'] = value
    
    # Extract input parameters
    input_params = {}
    for key, value in kwargs.items():
        if key.startswith('input_'):
            clean_key = key.replace('input_', '')
            input_params[clean_key] = value
    
    return TestCase(
        name=name,
        description=description,
        input=TestInput(
            instructions=instructions,
            context=context or {},
            tools=should_call_tools or [],
            **input_params
        ),
        expected=ExpectedResult(
            should_succeed=should_succeed,
            should_generate_code=should_generate_code,
            should_call_tools=should_call_tools or [],
            **expected_params
        )
    )