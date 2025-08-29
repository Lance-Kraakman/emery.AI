// AIDEV-NOTE: Shared test case interface for structured input/output testing
// Keeps test data clean and declarative without setup/mocks cluttering the data

export interface TestCase<TInput, TOutput> {
  name: string;
  input: TInput;
  expected: TOutput;
}