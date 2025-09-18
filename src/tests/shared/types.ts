// AIDEV-NOTE: Shared test types for integration tests
// TestCase interface follows golang-style table-driven tests

export interface TestCase<TInput, TOutput> {
  name: string;
  input: TInput;
  expected: TOutput;
}

export interface ValidationTestCase<TInput> {
  name: string;
  input: TInput;
  expectedError?: string;
  shouldPass?: boolean;
}