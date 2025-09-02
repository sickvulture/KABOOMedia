#!/usr/bin/env python3
"""
Comprehensive test runner for the Decentralized Social Media Platform

This script runs all tests and provides detailed reporting and coverage analysis.
"""

import unittest
import sys
import os
import time
import argparse
from pathlib import Path
from io import StringIO

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

class ColoredTestResult(unittest.TextTestResult):
    """Enhanced test result with colors and better formatting"""
    
    def __init__(self, stream, descriptions, verbosity):
        super().__init__(stream, descriptions, verbosity)
        self.use_colors = hasattr(stream, 'isatty') and stream.isatty()
        
    def _color(self, color_code, text):
        if self.use_colors:
            return f"\033[{color_code}m{text}\033[0m"
        return text
        
    def _green(self, text):
        return self._color("32", text)
        
    def _red(self, text):
        return self._color("31", text)
        
    def _yellow(self, text):
        return self._color("33", text)
        
    def _blue(self, text):
        return self._color("34", text)
        
    def startTest(self, test):
        super().startTest(test)
        if self.verbosity >= 2:
            self.stream.write(f"Running {test._testMethodName} ... ")
            self.stream.flush()
            
    def addSuccess(self, test):
        super().addSuccess(test)
        if self.verbosity >= 2:
            self.stream.writeln(self._green("OK"))
        elif self.verbosity == 1:
            self.stream.write(self._green("."))
            self.stream.flush()
            
    def addError(self, test, err):
        super().addError(test, err)
        if self.verbosity >= 2:
            self.stream.writeln(self._red("ERROR"))
        elif self.verbosity == 1:
            self.stream.write(self._red("E"))
            self.stream.flush()
            
    def addFailure(self, test, err):
        super().addFailure(test, err)
        if self.verbosity >= 2:
            self.stream.writeln(self._red("FAIL"))
        elif self.verbosity == 1:
            self.stream.write(self._red("F"))
            self.stream.flush()
            
    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        if self.verbosity >= 2:
            self.stream.writeln(self._yellow(f"SKIPPED: {reason}"))
        elif self.verbosity == 1:
            self.stream.write(self._yellow("S"))
            self.stream.flush()

class TestRunner:
    """Main test runner with comprehensive reporting"""
    
    def __init__(self):
        self.test_dir = Path(__file__).parent
        self.start_time = None
        self.end_time = None
        
    def discover_tests(self, pattern='test_*.py', start_dir=None):
        """Discover all test files"""
        if start_dir is None:
            start_dir = str(self.test_dir)
            
        loader = unittest.TestLoader()
        suite = loader.discover(start_dir, pattern=pattern, top_level_dir=str(self.test_dir))
        return suite
        
    def run_specific_module(self, module_name):
        """Run tests for a specific module"""
        loader = unittest.TestLoader()
        try:
            suite = loader.loadTestsFromName(module_name)
            return suite
        except (ImportError, AttributeError) as e:
            print(f"Error loading module {module_name}: {e}")
            return unittest.TestSuite()
            
    def run_specific_class(self, class_name):
        """Run tests for a specific test class"""
        loader = unittest.TestLoader()
        try:
            suite = loader.loadTestsFromName(class_name)
            return suite
        except (ImportError, AttributeError) as e:
            print(f"Error loading test class {class_name}: {e}")
            return unittest.TestSuite()
            
    def create_test_runner(self, verbosity=2, stream=None):
        """Create test runner with custom result class"""
        if stream is None:
            stream = sys.stdout
            
        return unittest.TextTestRunner(
            stream=stream,
            verbosity=verbosity,
            resultclass=ColoredTestResult,
            buffer=True,
            failfast=False
        )
        
    def print_test_summary(self, result):
        """Print detailed test summary"""
        total_tests = result.testsRun
        failures = len(result.failures)
        errors = len(result.errors)
        skipped = len(result.skipped)
        successful = total_tests - failures - errors - skipped
        
        print("\n" + "="*70)
        print("TEST SUMMARY")
        print("="*70)
        
        print(f"Total tests run: {total_tests}")
        print(f"Successful: {successful}")
        print(f"Failures: {failures}")
        print(f"Errors: {errors}")
        print(f"Skipped: {skipped}")
        
        if self.start_time and self.end_time:
            duration = self.end_time - self.start_time
            print(f"Duration: {duration:.2f} seconds")
            
        success_rate = (successful / total_tests * 100) if total_tests > 0 else 0
        print(f"Success rate: {success_rate:.1f}%")
        
        # Detailed failure/error reporting
        if result.failures:
            print(f"\n{'-'*50}")
            print(f"FAILURES ({len(result.failures)}):")
            print(f"{'-'*50}")
            for test, traceback in result.failures:
                print(f"\n{test}:")
                print(traceback)
                
        if result.errors:
            print(f"\n{'-'*50}")
            print(f"ERRORS ({len(result.errors)}):")
            print(f"{'-'*50}")
            for test, traceback in result.errors:
                print(f"\n{test}:")
                print(traceback)
                
        if result.skipped:
            print(f"\n{'-'*50}")
            print(f"SKIPPED ({len(result.skipped)}):")
            print(f"{'-'*50}")
            for test, reason in result.skipped:
                print(f"{test}: {reason}")
                
    def run_coverage_analysis(self):
        """Run coverage analysis if coverage.py is available"""
        try:
            import coverage
            
            cov = coverage.Coverage(source=[str(project_root)])
            cov.start()
            
            # Run tests
            suite = self.discover_tests()
            runner = self.create_test_runner(verbosity=1)
            result = runner.run(suite)
            
            cov.stop()
            cov.save()
            
            print(f"\n{'='*70}")
            print("COVERAGE ANALYSIS")
            print(f"{'='*70}")
            
            # Print coverage report
            cov.report(show_missing=True)
            
            # Generate HTML report
            html_dir = self.test_dir / 'coverage_html'
            cov.html_report(directory=str(html_dir))
            print(f"\nHTML coverage report generated in: {html_dir}")
            
            return result
            
        except ImportError:
            print("Coverage analysis not available - install coverage.py for detailed reports")
            return None
            
    def run_performance_tests(self):
        """Run performance-focused tests"""
        performance_patterns = [
            'test_*performance*.py',
            'test_*benchmark*.py',
            'test_*load*.py'
        ]
        
        print(f"\n{'='*70}")
        print("PERFORMANCE TESTS")
        print(f"{'='*70}")
        
        total_suite = unittest.TestSuite()
        
        for pattern in performance_patterns:
            suite = self.discover_tests(pattern=pattern)
            total_suite.addTests(suite)
            
        if total_suite.countTestCases() == 0:
            print("No performance tests found")
            return None
            
        runner = self.create_test_runner(verbosity=2)
        return runner.run(total_suite)
        
    def run_integration_tests(self):
        """Run integration tests specifically"""
        print(f"\n{'='*70}")
        print("INTEGRATION TESTS")
        print(f"{'='*70}")
        
        integration_patterns = [
            'test_integration*.py',
            'test_*integration*.py'
        ]
        
        total_suite = unittest.TestSuite()
        
        for pattern in integration_patterns:
            suite = self.discover_tests(pattern=pattern)
            total_suite.addTests(suite)
            
        if total_suite.countTestCases() == 0:
            print("No integration tests found")
            return None
            
        runner = self.create_test_runner(verbosity=2)
        return runner.run(total_suite)
        
    def check_dependencies(self):
        """Check if required dependencies are available for testing"""
        dependencies = [
            ('requests', 'HTTP client testing'),
            ('cryptography', 'Encryption tests'),
            ('qrcode', 'QR code generation tests'),
            ('netifaces', 'Network interface tests'),
            ('jinja2', 'Template engine tests')
        ]
        
        print(f"{'='*70}")
        print("DEPENDENCY CHECK")
        print(f"{'='*70}")
        
        missing_deps = []
        
        for dep, description in dependencies:
            try:
                __import__(dep)
                print(f"✓ {dep}: Available ({description})")
            except ImportError:
                print(f"✗ {dep}: Missing ({description})")
                missing_deps.append(dep)
                
        if missing_deps:
            print(f"\nWarning: Some tests may be skipped due to missing dependencies:")
            print(f"Install missing dependencies with: pip install {' '.join(missing_deps)}")
            
        return len(missing_deps) == 0
        
    def run_all_tests(self, verbosity=2, include_coverage=False):
        """Run all tests with comprehensive reporting"""
        print(f"{'='*70}")
        print("DECENTRALIZED SOCIAL MEDIA PLATFORM - TEST SUITE")
        print(f"{'='*70}")
        
        # Check dependencies
        self.check_dependencies()
        
        self.start_time = time.time()
        
        if include_coverage:
            result = self.run_coverage_analysis()
        else:
            # Regular test run
            suite = self.discover_tests()
            runner = self.create_test_runner(verbosity=verbosity)
            result = runner.run(suite)
            
        self.end_time = time.time()
        
        if result:
            self.print_test_summary(result)
            
        # Run integration tests separately if requested
        if verbosity >= 2:
            integration_result = self.run_integration_tests()
            
        return result

def main():
    """Main entry point for test runner"""
    parser = argparse.ArgumentParser(description='Run tests for Decentralized Social Media Platform')
    
    parser.add_argument('--verbose', '-v', action='count', default=1,
                       help='Increase verbosity (use -vv for very verbose)')
    parser.add_argument('--coverage', action='store_true',
                       help='Run with coverage analysis')
    parser.add_argument('--integration', action='store_true',
                       help='Run integration tests only')
    parser.add_argument('--performance', action='store_true',
                       help='Run performance tests only')
    parser.add_argument('--module', type=str,
                       help='Run tests for specific module')
    parser.add_argument('--class', type=str, dest='test_class',
                       help='Run tests for specific test class')
    parser.add_argument('--pattern', type=str, default='test_*.py',
                       help='Test file pattern to discover')
    
    args = parser.parse_args()
    
    runner = TestRunner()
    
    try:
        if args.module:
            suite = runner.run_specific_module(args.module)
            test_runner = runner.create_test_runner(verbosity=args.verbose)
            result = test_runner.run(suite)
            
        elif args.test_class:
            suite = runner.run_specific_class(args.test_class)
            test_runner = runner.create_test_runner(verbosity=args.verbose)
            result = test_runner.run(suite)
            
        elif args.integration:
            result = runner.run_integration_tests()
            
        elif args.performance:
            result = runner.run_performance_tests()
            
        else:
            result = runner.run_all_tests(
                verbosity=args.verbose,
                include_coverage=args.coverage
            )
            
        # Exit with appropriate code
        if result and (result.failures or result.errors):
            sys.exit(1)
        else:
            sys.exit(0)
            
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error running tests: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
