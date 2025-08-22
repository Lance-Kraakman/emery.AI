#!/usr/bin/env python3
"""
Simple Evaluation Platform Demo

AIDEV-NOTE: Demonstrates the simplified table-driven evaluation platform.
Shows clear, readable testing similar to Go's table-driven test pattern.
"""

from typing import List

from emery_agents.domain.evaluation.entities.test_case import (
    TestCase, TestSuite, get_test_suite, create_custom_test_case
)
from emery_agents.domain.evaluation.services.simple_evaluator import (
    SimpleEvaluator, 
    create_successful_code_result, 
    create_successful_tool_result, 
    create_failed_result
)


def demo_custom_test_cases():
    """Demonstrate creating custom test cases with clear input/expected patterns."""
    print("🔬 DEMO 1: Custom Test Cases")
    print("=" * 50)
    
    # Create custom test cases using the simple helper function
    test_cases = [
        create_custom_test_case(
            name="pandas_data_loading",
            description="Should load CSV data using pandas",
            instructions="Load the provided CSV data into a pandas DataFrame",
            should_succeed=True,
            should_generate_code=True,
            expected_should_contain=["pandas", "DataFrame"],
            expected_should_have_variables=["df", "data"]
        ),
        
        create_custom_test_case(
            name="email_sending",
            description="Should send email using Gmail tool",
            instructions="Send email to recipient using Gmail API",
            should_succeed=True,
            should_generate_code=False,
            should_call_tools=["gmail_send"],
            expected_should_contain=["sent", "message_id"]
        ),
        
        create_custom_test_case(
            name="expected_failure",
            description="Should fail as expected for impossible task",
            instructions="Divide by zero and return the result",
            should_succeed=False  # We expect this to fail
        )
    ]
    
    # Create corresponding mock results
    actual_results = [
        # pandas_data_loading - SUCCESS
        create_successful_code_result(
            "import pandas as pd\ndf = pd.DataFrame(csv_data)\ndata = df.copy()",
            variables=["df", "data"],
            execution_time_ms=1200
        ),
        
        # email_sending - SUCCESS  
        create_successful_tool_result(
            called_tools=["gmail_send"],
            execution_time_ms=2500,
            output_text="Email sent successfully, message_id: abc123"
        ),
        
        # expected_failure - FAILURE (expected)
        create_failed_result(
            error_message="ZeroDivisionError: division by zero",
            execution_time_ms=300
        )
    ]
    
    # Create test suite and evaluate
    custom_suite = TestSuite("Custom Demo Tests", "Demonstration of custom test cases", test_cases)
    evaluator = SimpleEvaluator()
    report = evaluator.evaluate_test_suite(custom_suite, actual_results)
    evaluator.print_evaluation_report(report)


def demo_predefined_test_suites():
    """Demonstrate using pre-defined test suites."""
    print("\n🎯 DEMO 2: Pre-defined Test Suites")
    print("=" * 50)
    
    # Get pre-defined email test suite
    email_suite = get_test_suite("email")
    print(f"📧 Using pre-defined '{email_suite.name}' with {email_suite.total_tests} tests")
    
    # Simulate perfect execution
    perfect_results = [
        create_successful_code_result(
            'email_data = {"recipient": "test@example.com", "subject": "Test", "body": "Hello World"}\nrecipient = email_data["recipient"]\nsubject = email_data["subject"]\nbody = email_data["body"]',
            variables=["email_data", "recipient", "subject", "body"],
            execution_time_ms=1000,
            output_text="Email composed with test@example.com, Test, Hello World"
        ),
        create_successful_tool_result(
            called_tools=["gmail_send"],
            execution_time_ms=2000,
            output_text="Email sent successfully, message_id: msg_12345"
        ),
        create_successful_tool_result(
            called_tools=["gmail_send"],
            execution_time_ms=3000,
            output_text="Email with attachment sent successfully"
        )
    ]
    
    evaluator = SimpleEvaluator()
    report = evaluator.evaluate_test_suite(email_suite, perfect_results)
    evaluator.print_evaluation_report(report)


def demo_failure_scenarios():
    """Demonstrate clear failure reporting."""
    print("\n❌ DEMO 3: Failure Scenarios")
    print("=" * 50)
    
    # Get web search test suite
    search_suite = get_test_suite("web_search")
    print(f"🔍 Testing '{search_suite.name}' with deliberate failures")
    
    # Create results with various types of failures
    failing_results = [
        # basic_web_search - FAIL (wrong tool called)
        create_successful_tool_result(
            called_tools=["wrong_search_tool"],  # Expected web_search
            execution_time_ms=1500,
            output_text="Search completed but with wrong tool"
        ),
        
        # filter_search_results - FAIL (missing expected content)
        create_successful_code_result(
            "results = []",  # Missing github.com, stackoverflow.com, filter
            variables=["results"],
            execution_time_ms=800
        )
    ]
    
    evaluator = SimpleEvaluator()
    report = evaluator.evaluate_test_suite(search_suite, failing_results)
    evaluator.print_evaluation_report(report)


def demo_comparison_with_old_approach():
    """Show the difference between old complex approach and new simple approach."""
    print("\n🔄 DEMO 4: Simplicity Comparison")
    print("=" * 50)
    
    print("❌ OLD COMPLEX APPROACH:")
    print("""
    # Complex domain entities, validation rules, step-specific evaluators
    scenario = CapabilityTestScenario(
        capability_name="email_send",
        step_tests=[
            StepTestScenario(
                step_id="compose_email",
                step_type=StepType.CODE_STEP,
                expected_behavior=ExpectedStepBehavior(
                    should_produce_code=True,
                    expected_variables=["email_data"]
                ),
                validation_rules=[
                    ValidationRule(
                        rule_type=ValidationRuleType.CONTAINS,
                        pattern="email",
                        required=True
                    )
                ]
            )
        ]
    )
    # Then complex evaluation with multiple evaluator classes...
    """)
    
    print("✅ NEW SIMPLE APPROACH:")
    print("""
    # Clean, readable test case
    test_case = create_custom_test_case(
        name="email_compose",
        description="Compose email data",
        instructions="Create email with recipient and subject",
        should_succeed=True,
        should_generate_code=True,
        expected_should_have_variables=["email_data"],
        expected_should_contain=["email"]
    )
    
    # Simple evaluation
    evaluator = SimpleEvaluator()
    result = evaluator.evaluate_test_case(test_case, actual_result)
    print(f"✅ PASS" if result.passed else f"❌ FAIL: {result.failure_reason}")
    """)
    
    print("\n📊 BENEFITS OF SIMPLE APPROACH:")
    print("• Clear input/expected/actual pattern (like Go table tests)")
    print("• Boolean pass/fail results (no complex validation objects)")
    print("• Readable failure messages")
    print("• Easy to write and maintain tests")
    print("• Visual reports with ✅/❌ indicators")
    print("• Pre-defined test suites for common capabilities")


if __name__ == "__main__":
    print("🚀 SIMPLE EVALUATION PLATFORM DEMO")
    print("=" * 60)
    print("Demonstrating Go-style table-driven testing for agent evaluation\n")
    
    demo_custom_test_cases()
    demo_predefined_test_suites()
    demo_failure_scenarios()
    demo_comparison_with_old_approach()
    
    print("\n✨ CONCLUSION")
    print("=" * 60)
    print("The simplified evaluation platform provides:")
    print("• Clear, readable test definitions")
    print("• Simple pass/fail evaluation logic")
    print("• Beautiful visual reports")
    print("• Easy maintenance and extension")
    print("• Go-style table-driven testing patterns")
    print("\nReady for production use! 🎉")