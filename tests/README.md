# Decentralized Social Media Platform - Test Suite

This directory contains comprehensive tests for all components of the decentralized social media platform. The test suite is designed to ensure reliability, security, and performance of the entire system.

## Test Structure

```
tests/
├── __init__.py                     # Test package initialization
├── README.md                       # This file
├── test_runner.py                  # Comprehensive test runner
├── test_integration.py             # Integration tests
├── test_core/                      # Core functionality tests
│   ├── __init__.py
│   ├── test_encryption.py          # Encryption engine tests
│   ├── test_storage.py             # Storage system tests
│   ├── test_p2p_network.py         # P2P networking tests
│   ├── test_web_server.py          # Web server tests
│   └── test_nat_traversal.py       # NAT traversal tests
├── test_site_generator/            # Site generation tests
│   ├── __init__.py
│   ├── test_template_engine.py     # Template engine tests
│   ├── test_address_manager.py     # Address management tests
│   └── test_qr_generator.py        # QR code generation tests
├── test_registry/                  # Registry service tests
│   ├── __init__.py
│   ├── test_client.py              # Registry client tests
│   ├── test_server.py              # Registry server tests
│   └── test_discovery.py           # Discovery service tests
├── test_database/                  # Database tests
│   ├── __init__.py
│   └── test_models.py              # Data model tests
└── test_utils/                     # Utility tests
    ├── __init__.py
    └── test_config.py              # Configuration tests
```

## Running Tests

### Quick Start

Run all tests with the default configuration:

```bash
python -m tests.test_runner
```

### Comprehensive Test Runner

The `test_runner.py` provides a comprehensive testing interface with many options:

```bash
# Run all tests with verbose output
python tests/test_runner.py -vv

# Run with coverage analysis
python tests/test_runner.py --coverage

# Run only integration tests
python tests/test_runner.py --integration

# Run performance tests
python tests/test_runner.py --performance

# Run tests for specific module
python tests/test_runner.py --module tests.test_core.test_encryption

# Run specific test class
python tests/test_runner.py --class tests.test_core.test_encryption.TestEncryptionEngine
```

### Individual Test Modules

You can also run individual test modules directly:

```bash
# Run encryption tests
python -m tests.test_core.test_encryption

# Run storage tests
python -m tests.test_core.test_storage

# Run integration tests
python -m tests.test_integration
```

### Using Standard unittest

All tests are compatible with Python's standard unittest framework:

```bash
# Discover and run all tests
python -m unittest discover tests/

# Run specific test file
python -m unittest tests.test_core.test_encryption

# Run specific test class
python -m unittest tests.test_core.test_encryption.TestEncryptionEngine

# Run specific test method
python -m unittest tests.test_core.test_encryption.TestEncryptionEngine.test_encrypt_decrypt_data
```

## Test Categories

### Unit Tests

Individual component tests located in module-specific directories:

- **Core Tests** (`test_core/`): Test fundamental system components
  - Encryption/decryption functionality
  - File storage and sandboxing
  - P2P networking and communication
  - Web server and routing
  - NAT traversal capabilities

- **Site Generator Tests** (`test_site_generator/`): Test website generation
  - Template rendering and customization
  - Dynamic address management
  - QR code generation for sharing

- **Database Tests** (`test_database/`): Test data persistence
  - Data model validation
  - Database operations (when implemented)

- **Utility Tests** (`test_utils/`): Test helper functions
  - Configuration management
  - Cryptographic utilities
  - Network utilities

### Integration Tests

Located in `test_integration.py`, these tests verify that components work correctly together:

- Complete application lifecycle
- Cross-component data flow
- Service startup/shutdown coordination
- Concurrent operation handling
- Error propagation and handling

### Registry Tests

Located in `test_registry/`, these test the optional centralized discovery system:

- Registry client operations
- Registry server functionality
- Multi-registry discovery
- Failover and load balancing

## Dependencies

### Required for Basic Tests

- Python 3.8+ (included in standard library)
- unittest (included in standard library)

### Optional for Enhanced Tests

Install optional dependencies for full test coverage:

```bash
pip install requests cryptography qrcode[pil] netifaces jinja2 coverage psutil
```

- **requests**: HTTP client testing for web server and registry tests
- **cryptography**: Encryption functionality tests
- **qrcode[pil]**: QR code generation tests
- **netifaces**: Network interface discovery tests
- **jinja2**: Template engine tests
- **coverage**: Code coverage analysis
- **psutil**: Memory usage and performance tests

### Test-Only Dependencies

Some tests use mocking and other test-specific features:

- **unittest.mock**: Built into Python 3.8+ for mocking external dependencies
- **tempfile**: Built-in module for temporary file/directory creation during tests

## Test Features

### Comprehensive Coverage

- **Unit Tests**: Individual component testing
- **Integration Tests**: Component interaction testing
- **Performance Tests**: Memory usage and timing validation
- **Security Tests**: Encryption and data protection validation
- **Network Tests**: P2P communication and web server functionality

### Enhanced Test Runner

The custom test runner provides:

- **Colored Output**: Green for success, red for failures, yellow for skipped
- **Detailed Reporting**: Comprehensive test summaries with timing
- **Coverage Analysis**: Code coverage reporting with HTML output
- **Dependency Checking**: Automatic detection of missing test dependencies
- **Flexible Execution**: Run specific modules, classes, or test patterns

### Mocking and Isolation

Tests use extensive mocking to:

- Isolate components from external dependencies
- Test error conditions and edge cases
- Avoid network calls during unit testing
- Simulate various system conditions

## Test Writing Guidelines

### Test Structure

Follow these patterns when writing new tests:

```python
import unittest
from unittest.mock import patch, MagicMock

class TestMyComponent(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures before each test method"""
        self.component = MyComponent()
        
    def tearDown(self):
        """Clean up after each test method"""
        # Clean up resources, files, connections, etc.
        pass
        
    def test_specific_functionality(self):
        """Test a specific piece of functionality"""
        # Arrange
        test_data = "test input"
        expected_result = "expected output"
        
        # Act
        result = self.component.process(test_data)
        
        # Assert
        self.assertEqual(result, expected_result)
```

### Naming Conventions

- Test files: `test_<module_name>.py`
- Test classes: `Test<ComponentName>`
- Test methods: `test_<specific_functionality>`

### Test Categories by Method Name

- `test_<normal_case>`: Standard functionality tests
- `test_<edge_case>`: Boundary condition tests
- `test_<error_case>`: Error handling tests
- `test_<integration_case>`: Cross-component tests

### Mocking External Dependencies

```python
@patch('requests.get')
def test_network_call(self, mock_get):
    mock_get.return_value.status_code = 200
    mock_get.return_value.json.return_value = {'status': 'success'}
    
    result = self.component.make_network_call()
    self.assertEqual(result['status'], 'success')
```

## Continuous Integration

Tests are designed to run in CI/CD environments:

- No external dependencies for basic functionality
- Temporary file cleanup
- Deterministic test execution
- Appropriate exit codes
- Machine-readable output formats

### GitHub Actions Example

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - run: pip install -r requirements.txt
      - run: python tests/test_runner.py --coverage
```

## Performance Testing

Performance tests focus on:

- Memory usage during operations
- Response times for network operations
- Encryption/decryption speed
- Database query performance
- Concurrent operation handling

Run performance-focused tests:

```bash
python tests/test_runner.py --performance
```

## Coverage Reports

Generate detailed coverage reports:

```bash
# Run with coverage analysis
python tests/test_runner.py --coverage

# Coverage files are generated in tests/coverage_html/
# Open tests/coverage_html/index.html in a browser
```

## Troubleshooting

### Common Issues

1. **Import Errors**: Ensure you're running tests from the project root directory
2. **Missing Dependencies**: Install optional dependencies for full test coverage
3. **Permission Errors**: Ensure write permissions for temporary test files
4. **Port Conflicts**: Tests use non-standard ports (18080, 19999) to avoid conflicts

### Debugging Tests

Run individual tests with maximum verbosity:

```bash
python -m unittest tests.test_core.test_encryption.TestEncryptionEngine.test_encrypt_decrypt_data -v
```

Use the Python debugger in tests:

```python
import pdb; pdb.set_trace()  # Add this line in test code for debugging
```

### Test Data Cleanup

Tests automatically clean up temporary files and directories. If cleanup fails:

```bash
# Remove temporary test files
find . -name "__pycache__" -type d -exec rm -rf {} +
find . -name "*.pyc" -delete
rm -rf tests/coverage_html/
```

## Contributing Tests

When contributing new features:

1. **Write tests first** (Test-Driven Development)
2. **Ensure comprehensive coverage** of new functionality
3. **Include both positive and negative test cases**
4. **Mock external dependencies** to ensure test isolation
5. **Update this README** if adding new test categories

### Test Checklist

- [ ] Unit tests for new components
- [ ] Integration tests for cross-component features
- [ ] Error handling tests
- [ ] Performance impact tests (for significant features)
- [ ] Documentation updates
- [ ] All tests pass locally
- [ ] Coverage remains high (>90% target)

## License

Tests are part of the Decentralized Social Media Platform and are licensed under GNU General Public License v3.0.
