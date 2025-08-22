"""
Simple Table-Driven Tests

AIDEV-NOTE: Clear, readable tests using Go-style table-driven testing pattern.
Each test case has clear input, expected result, and actual result.
"""

import pytest
from typing import List

from emery_agents.domain.evaluation.entities.test_case import (
    TestCase, TestSuite, TestInput, ExpectedResult, ActualResult,
    create_custom_test_case, get_test_suite,
    EMAIL_TEST_CASES, DATA_ANALYSIS_TEST_CASES, WEB_SEARCH_TEST_CASES
)
from emery_agents.domain.evaluation.services.simple_evaluator import (
    SimpleEvaluator, EvaluationReport,
    create_successful_code_result, create_successful_tool_result, create_failed_result
)


class TestSimpleEvaluator:
    """Test the simplified table-driven evaluator."""
    
    def setup_method(self):
        """Setup for each test method."""
        self.evaluator = SimpleEvaluator()
    
    def test_successful_code_test_case(self):
        """Test evaluation of successful code generation."""
        test_case = create_custom_test_case(
            name="test_pandas_code",
            description="Generate pandas code for data loading",
            instructions="Load CSV data using pandas",
            should_succeed=True,
            should_generate_code=True,
            expected_should_contain=["pandas", "DataFrame"],
            expected_should_have_variables=["df", "data"]
        )
        
        actual_result = create_successful_code_result(
            generated_code="""
import pandas as pd
df = pd.DataFrame(csv_data)
data = df.copy()
print("Data loaded successfully")
            """.strip(),
            variables=["df", "data"],
            execution_time_ms=1500
        )
        
        evaluated = self.evaluator.evaluate_test_case(test_case, actual_result)
        
        assert evaluated.passed is True
        assert evaluated.failure_reason is None
        assert evaluated.actual == actual_result
    
    def test_successful_tool_test_case(self):
        """Test evaluation of successful tool usage."""
        test_case = create_custom_test_case(
            name="test_email_send",
            description="Send email using Gmail tool",
            instructions="Send email to recipient",
            should_succeed=True,
            should_generate_code=False,
            should_call_tools=["gmail_send"],
            expected_should_contain=["sent", "message_id"]
        )
        
        actual_result = create_successful_tool_result(
            called_tools=["gmail_send"],
            execution_time_ms=2500,
            output_text="Email sent successfully, message_id: abc123"
        )
        
        evaluated = self.evaluator.evaluate_test_case(test_case, actual_result)
        
        assert evaluated.passed is True
        assert evaluated.failure_reason is None
    
    def test_failed_test_case_missing_tool(self):
        """Test evaluation when expected tool is not called."""
        test_case = create_custom_test_case(
            name="test_missing_tool",
            description="Should call web_search tool",
            instructions="Search the web for information",
            should_succeed=True,
            should_call_tools=["web_search"]
        )
        
        actual_result = create_successful_tool_result(
            called_tools=["wrong_tool"],  # Wrong tool called
            execution_time_ms=1000
        )
        
        evaluated = self.evaluator.evaluate_test_case(test_case, actual_result)
        
        assert evaluated.passed is False
        assert "web_search" in evaluated.failure_reason
        assert "wrong_tool" in evaluated.failure_reason
    
    def test_failed_test_case_missing_content(self):
        """Test evaluation when expected content is missing."""
        test_case = create_custom_test_case(
            name="test_missing_content",
            description="Should generate code with pandas",
            instructions="Create pandas DataFrame",
            should_succeed=True,
            should_generate_code=True,
            expected_should_contain=["pandas", "DataFrame"]
        )
        
        actual_result = create_successful_code_result(
            generated_code="data = []  # No pandas here",
            variables=["data"],
            execution_time_ms=800
        )
        
        evaluated = self.evaluator.evaluate_test_case(test_case, actual_result)
        
        assert evaluated.passed is False
        assert "DataFrame" in evaluated.failure_reason
    
    def test_failed_test_case_execution_failure(self):
        """Test evaluation when execution fails."""
        test_case = create_custom_test_case(
            name="test_execution_failure",
            description="Should succeed but execution fails",
            instructions="Do something that works",
            should_succeed=True
        )
        
        actual_result = create_failed_result(
            error_message="Syntax error in generated code",
            execution_time_ms=300
        )
        
        evaluated = self.evaluator.evaluate_test_case(test_case, actual_result)
        
        assert evaluated.passed is False
        assert "Expected success=True, got success=False" in evaluated.failure_reason
        assert "Syntax error" in evaluated.failure_reason
    
    def test_expected_failure_passes(self):
        """Test that expected failures are marked as passing."""
        test_case = create_custom_test_case(
            name="test_expected_failure",
            description="Should fail as expected",
            instructions="Do something impossible",
            should_succeed=False  # We expect this to fail
        )
        
        actual_result = create_failed_result(
            error_message="Task impossible to complete"
        )
        
        evaluated = self.evaluator.evaluate_test_case(test_case, actual_result)
        
        assert evaluated.passed is True  # Expected failure = pass
        assert evaluated.failure_reason is None
    
    def test_test_suite_evaluation(self):
        """Test evaluation of entire test suite."""
        test_suite = TestSuite(
            name="Sample Test Suite",
            description="Test suite for demonstration",
            test_cases=[
                create_custom_test_case(
                    name="test_1",
                    description="Should pass",
                    instructions="Generate simple code",
                    should_succeed=True,
                    should_generate_code=True
                ),
                create_custom_test_case(
                    name="test_2", 
                    description="Should also pass",
                    instructions="Call a tool",
                    should_succeed=True,
                    should_call_tools=["test_tool"]
                ),
                create_custom_test_case(
                    name="test_3",
                    description="Should fail",
                    instructions="Missing expected content",
                    should_succeed=True,
                    expected_should_contain=["missing_pattern"]
                )
            ]
        )
        
        actual_results = [
            create_successful_code_result("x = 1", ["x"], 1000),
            create_successful_tool_result(["test_tool"], 1500),
            create_successful_code_result("y = 2", ["y"], 800)  # Missing "missing_pattern"
        ]
        
        report = self.evaluator.evaluate_test_suite(test_suite, actual_results)
        
        assert report.total_tests == 3
        assert report.passed_tests == 2
        assert report.failed_tests == 1
        assert report.success_rate == (2/3) * 100
        assert report.execution_time_ms == 3300  # 1000 + 1500 + 800
        assert len(report.failures) == 1
        assert "test_3" in report.failures[0]


class TestPreDefinedTestSuites:
    """Test the pre-defined test suites work correctly."""
    
    def setup_method(self):
        """Setup for each test method."""
        self.evaluator = SimpleEvaluator()
    
    def test_email_test_suite_structure(self):
        """Test email test suite is properly structured."""
        email_suite = get_test_suite("email")
        
        assert email_suite is not None
        assert email_suite.name == "Email Capability Tests"
        assert len(email_suite.test_cases) == 3
        
        # Check test case names
        test_names = [tc.name for tc in email_suite.test_cases]
        assert "simple_email_compose" in test_names
        assert "send_email_via_gmail" in test_names
        assert "email_with_attachment" in test_names
    
    def test_data_analysis_test_suite_structure(self):
        """Test data analysis test suite is properly structured."""
        data_suite = get_test_suite("data_analysis")
        
        assert data_suite is not None
        assert len(data_suite.test_cases) == 3
        
        # Check that code steps expect code generation
        for test_case in data_suite.test_cases:
            if test_case.input.expected_step_type == "CODE_STEP":
                assert test_case.expected.should_generate_code is True
    
    def test_web_search_test_suite_structure(self):
        """Test web search test suite is properly structured."""
        search_suite = get_test_suite("web_search")
        
        assert search_suite is not None
        assert len(search_suite.test_cases) == 2
        
        # Check that tool steps expect tool calls
        for test_case in search_suite.test_cases:
            if test_case.input.expected_step_type == "TOOL_STEP":
                assert len(test_case.expected.should_call_tools) > 0
    
    def test_email_test_suite_simulation(self):
        """Test email test suite with simulated results."""
        email_suite = get_test_suite("email")
        
        # Simulate results for each test case
        actual_results = [
            # simple_email_compose - CODE_STEP
            create_successful_code_result(
                generated_code="""
email_data = {
    'recipient': 'test@example.com',
    'subject': 'Test',
    'body': 'Hello World'
}
recipient = email_data['recipient']
subject = email_data['subject']
body = email_data['body']
                """.strip(),
                variables=["email_data", "recipient", "subject", "body"],
                execution_time_ms=1200,
                output_text="Email composed with test@example.com, Test, Hello World"
            ),
            
            # send_email_via_gmail - TOOL_STEP
            create_successful_tool_result(
                called_tools=["gmail_send"],
                execution_time_ms=2800,
                output_text="Email sent successfully, message_id: msg_12345"
            ),
            
            # email_with_attachment - TOOL_STEP
            create_successful_tool_result(
                called_tools=["gmail_send"],
                execution_time_ms=4500,
                output_text="Email with PDF attachment sent successfully"
            )
        ]
        
        report = self.evaluator.evaluate_test_suite(email_suite, actual_results)
        
        assert report.total_tests == 3
        assert report.passed_tests == 3  # All should pass
        assert report.failed_tests == 0
        assert report.success_rate == 100.0
        
        # Print report for visual inspection
        self.evaluator.print_evaluation_report(report)
    
    def test_mixed_results_evaluation(self):
        """Test evaluation with mixed pass/fail results."""
        data_suite = get_test_suite("data_analysis")
        
        # Mix of successful and failed results
        actual_results = [
            # load_csv_data - SUCCESS
            create_successful_code_result(
                generated_code="import pandas as pd\ndf = pd.DataFrame(csv_data)\ndata = df.copy()",
                variables=["df", "data"],
                execution_time_ms=1000
            ),
            
            # calculate_statistics - FAIL (missing expected content)
            create_successful_code_result(
                generated_code="result = sum([25, 30]) / 2",  # No pandas, no mean/median
                variables=["result"],
                execution_time_ms=800
            ),
            
            # generate_visualization - SUCCESS
            create_successful_code_result(
                generated_code="""
import matplotlib.pyplot as plt
plot = plt.bar(['Alice', 'Bob'], [25, 30])
chart = plt.gcf()
plt.title('Age Distribution')
                """.strip(),
                variables=["plot", "chart"],
                execution_time_ms=2200
            )
        ]
        
        report = self.evaluator.evaluate_test_suite(data_suite, actual_results)
        
        assert report.total_tests == 3
        assert report.passed_tests == 2
        assert report.failed_tests == 1
        assert report.success_rate == (2/3) * 100
        assert len(report.failures) == 1
        assert "calculate_statistics" in report.failures[0]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])