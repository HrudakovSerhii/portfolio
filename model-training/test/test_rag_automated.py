#!/usr/bin/env python3
"""
Automated RAG Test Suite
Runs predefined test cases and compares RAG vs baseline responses.
"""

import sys
from typing import List, Dict, Tuple
from pathlib import Path

# Import RAGTester from main script
from test_rag import RAGTester


# Test cases from specification
TEST_CASES = [
    {
        "name": "HR Role - Business Impact",
        "query": "What was your impact at A-Dam?",
        "role": "hr",
        "expected_elements": ["100%", "revenue", "75%", "retention"],
        "description": "Should retrieve impact metrics and business results"
    },
    {
        "name": "Developer Role - Technical Architecture",
        "query": "How did you migrate EriksDigital from monolith to micro-frontend?",
        "role": "developer",
        "expected_elements": ["micro-frontend", "migration", "architecture"],
        "description": "Should retrieve technical migration details"
    },
    {
        "name": "Developer Role - Technology Stack",
        "query": "What's your experience with React and NextJS?",
        "role": "developer",
        "expected_elements": ["React", "NextJS", "Next.js"],
        "description": "Should retrieve multiple projects using React/NextJS"
    },
    {
        "name": "HR Role - Career Decisions",
        "query": "Why did you leave Hexaware/Mobiquity?",
        "role": "hr",
        "expected_elements": ["career", "growth", "opportunity"],
        "description": "Should retrieve career transition reasons"
    },
    {
        "name": "Friend Role - Personal Interests",
        "query": "What do you like to do in your free time?",
        "role": "friend",
        "expected_elements": ["hiking", "Alps", "outdoor", "travel"],
        "description": "Should retrieve hobbies and personal interests"
    }
]


class AutomatedTester:
    """Runs automated test suite and generates reports."""

    def __init__(self, verbose: bool = False):
        """Initialize automated tester."""
        self.verbose = verbose
        self.tester = RAGTester(verbose=verbose)
        self.results = []

    def check_expected_elements(self, response: str, expected: List[str]) -> Tuple[List[str], List[str]]:
        """Check which expected elements are present in response."""
        response_lower = response.lower()
        found = []
        missing = []

        for element in expected:
            if element.lower() in response_lower:
                found.append(element)
            else:
                missing.append(element)

        return found, missing

    def run_single_test(
        self,
        test_case: Dict,
        top_k: int = 5,
        threshold: float = 0.7,
        max_tokens: int = 200
    ) -> Dict:
        """Run a single test case and collect results."""
        print(f"\n{'=' * 80}")
        print(f"TEST CASE: {test_case['name']}")
        print(f"{'=' * 80}")
        print(f"Query: {test_case['query']}")
        print(f"Role: {test_case['role']}")
        print(f"Description: {test_case['description']}")
        print()

        try:
            # Load models if not already loaded
            if self.tester.embedding_model is None:
                self.tester.load_embedding_model()

            if self.tester.tokenizer is None or self.tester.llm_model is None:
                self.tester.load_finetuned_model()

            # Load embeddings
            chunks = self.tester.load_embeddings(test_case['role'])

            # Generate query embedding
            query_embedding = self.tester.generate_query_embedding(test_case['query'])

            # Find similar chunks
            retrieved_chunks = self.tester.find_top_chunks(
                query_embedding,
                chunks,
                top_k=top_k,
                threshold=threshold
            )

            # Build RAG context
            rag_context = self.tester.build_rag_context(retrieved_chunks)

            # Generate RAG response
            rag_response, rag_time = self.tester.generate_response(
                test_case['query'],
                test_case['role'],
                context=rag_context,
                max_tokens=max_tokens
            )

            # Generate baseline response
            baseline_response, baseline_time = self.tester.generate_response(
                test_case['query'],
                test_case['role'],
                context="",
                max_tokens=max_tokens
            )

            # Check expected elements
            rag_found, rag_missing = self.check_expected_elements(
                rag_response,
                test_case.get('expected_elements', [])
            )

            baseline_found, baseline_missing = self.check_expected_elements(
                baseline_response,
                test_case.get('expected_elements', [])
            )

            # Display results for this test
            print(f"RETRIEVED CHUNKS: {len(retrieved_chunks)}")
            if retrieved_chunks:
                print("Top similarities:")
                for i, result in enumerate(retrieved_chunks[:3], 1):
                    print(f"  [{i}] {result['similarity']:.3f} - {result['chunk']['id']}")
            print()

            print(f"RAG RESPONSE ({rag_time:.2f}s):")
            print("-" * 80)
            print(rag_response)
            print()

            print(f"BASELINE RESPONSE ({baseline_time:.2f}s):")
            print("-" * 80)
            print(baseline_response)
            print()

            print("EXPECTED ELEMENTS CHECK:")
            print("-" * 80)
            print(f"RAG found {len(rag_found)}/{len(test_case.get('expected_elements', []))} elements: {rag_found}")
            print(f"Baseline found {len(baseline_found)}/{len(test_case.get('expected_elements', []))} elements: {baseline_found}")
            print()

            # Determine if RAG improved the response
            rag_better = (
                len(rag_found) > len(baseline_found) or
                len(rag_response) > len(baseline_response)
            )

            if rag_better:
                print("VERDICT: ✅ RAG improved response quality")
            else:
                print("VERDICT: ⚠️  RAG did not significantly improve response")

            # Collect results
            result = {
                'test_name': test_case['name'],
                'query': test_case['query'],
                'role': test_case['role'],
                'chunks_retrieved': len(retrieved_chunks),
                'rag_response_length': len(rag_response),
                'baseline_response_length': len(baseline_response),
                'rag_time': rag_time,
                'baseline_time': baseline_time,
                'rag_found_elements': len(rag_found),
                'baseline_found_elements': len(baseline_found),
                'total_expected_elements': len(test_case.get('expected_elements', [])),
                'rag_better': rag_better,
                'success': True,
                'error': None
            }

        except Exception as e:
            print(f"ERROR: {e}")
            if self.verbose:
                import traceback
                traceback.print_exc()

            result = {
                'test_name': test_case['name'],
                'query': test_case['query'],
                'role': test_case['role'],
                'success': False,
                'error': str(e)
            }

        self.results.append(result)
        return result

    def run_all_tests(
        self,
        top_k: int = 5,
        threshold: float = 0.7,
        max_tokens: int = 200
    ):
        """Run all test cases."""
        print("=" * 80)
        print("AUTOMATED RAG TEST SUITE")
        print("=" * 80)
        print(f"Running {len(TEST_CASES)} test cases...")
        print()

        for i, test_case in enumerate(TEST_CASES, 1):
            print(f"\n[{i}/{len(TEST_CASES)}] Starting test: {test_case['name']}")
            self.run_single_test(test_case, top_k, threshold, max_tokens)

        # Generate summary report
        self.generate_summary_report()

    def generate_summary_report(self):
        """Generate and display summary report."""
        print("\n" + "=" * 80)
        print("SUMMARY REPORT")
        print("=" * 80)
        print()

        # Calculate statistics
        total_tests = len(self.results)
        successful_tests = sum(1 for r in self.results if r['success'])
        failed_tests = total_tests - successful_tests

        successful_results = [r for r in self.results if r['success']]

        if successful_results:
            rag_better_count = sum(1 for r in successful_results if r['rag_better'])
            avg_rag_time = sum(r['rag_time'] for r in successful_results) / len(successful_results)
            avg_baseline_time = sum(r['baseline_time'] for r in successful_results) / len(successful_results)
            avg_chunks = sum(r['chunks_retrieved'] for r in successful_results) / len(successful_results)

            total_expected = sum(r['total_expected_elements'] for r in successful_results)
            total_rag_found = sum(r['rag_found_elements'] for r in successful_results)
            total_baseline_found = sum(r['baseline_found_elements'] for r in successful_results)

        # Display summary
        print(f"Total tests run: {total_tests}")
        print(f"Successful: {successful_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print()

        if successful_results:
            print("RAG PERFORMANCE:")
            print("-" * 80)
            print(f"RAG improved responses: {rag_better_count}/{len(successful_results)} tests ({rag_better_count/len(successful_results)*100:.1f}%)")
            print(f"Average chunks retrieved: {avg_chunks:.1f}")
            print(f"Expected elements found (RAG): {total_rag_found}/{total_expected} ({total_rag_found/total_expected*100:.1f}%)")
            print(f"Expected elements found (Baseline): {total_baseline_found}/{total_expected} ({total_baseline_found/total_expected*100:.1f}%)")
            print()

            print("TIMING:")
            print("-" * 80)
            print(f"Average RAG response time: {avg_rag_time:.2f}s")
            print(f"Average baseline response time: {avg_baseline_time:.2f}s")
            print()

        # Test-by-test breakdown
        print("TEST BREAKDOWN:")
        print("-" * 80)
        for i, result in enumerate(self.results, 1):
            if result['success']:
                verdict = "✅ RAG better" if result['rag_better'] else "⚠️  Similar"
                print(f"[{i}] {result['test_name']}")
                print(f"    Chunks: {result['chunks_retrieved']}, "
                      f"Found: {result['rag_found_elements']}/{result['total_expected_elements']}, "
                      f"{verdict}")
            else:
                print(f"[{i}] {result['test_name']}")
                print(f"    ❌ FAILED: {result['error']}")

        print()
        print("=" * 80)

        # Overall verdict
        if failed_tests == 0 and successful_results and rag_better_count >= len(successful_results) * 0.6:
            print("OVERALL VERDICT: ✅ RAG system is working well!")
            print("RAG improves response quality by providing factual context.")
        elif failed_tests == 0:
            print("OVERALL VERDICT: ⚠️  RAG system works but improvements needed")
            print("Consider adjusting similarity threshold or chunk retrieval strategy.")
        else:
            print("OVERALL VERDICT: ❌ Some tests failed")
            print("Check error messages above and verify setup.")

        print("=" * 80)


def main():
    """Main entry point for automated test suite."""
    import argparse

    parser = argparse.ArgumentParser(
        description="Run automated RAG test suite"
    )

    parser.add_argument(
        "--top-k",
        type=int,
        default=5,
        help="Number of chunks to retrieve (default: 5)"
    )

    parser.add_argument(
        "--threshold",
        type=float,
        default=0.7,
        help="Minimum similarity threshold (default: 0.7)"
    )

    parser.add_argument(
        "--max-tokens",
        type=int,
        default=200,
        help="Maximum response length in tokens (default: 200)"
    )

    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show detailed debug output"
    )

    args = parser.parse_args()

    try:
        tester = AutomatedTester(verbose=args.verbose)
        tester.run_all_tests(
            top_k=args.top_k,
            threshold=args.threshold,
            max_tokens=args.max_tokens
        )

        # Return success if all tests passed and RAG improved most responses
        successful_results = [r for r in tester.results if r['success']]
        if successful_results:
            rag_better_count = sum(1 for r in successful_results if r['rag_better'])
            return 0 if rag_better_count >= len(successful_results) * 0.6 else 1
        else:
            return 1

    except Exception as e:
        print(f"Fatal error: {e}", file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit(main())
