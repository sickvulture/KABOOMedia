import unittest
import base64
import time
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from site_generator.qr_generator import QRCodeGenerator

class TestQRCodeGenerator(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.qr_generator = QRCodeGenerator()
        
        # Test data
        self.test_address_info = {
            'url': 'http://192.168.1.100:8080',
            'timestamp': time.time(),
            'id': 'abc123def456'
        }
        
        self.test_user_info = {
            'name': 'John Doe',
            'current_url': 'http://192.168.1.100:8080',
            'public_key': 'ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAAB...'
        }
        
    def test_initialization(self):
        """Test QR generator initialization"""
        self.assertIsNotNone(self.qr_generator.qr_settings)
        
        # Check default settings
        expected_settings = {
            'version': 1,
            'error_correction': 1,  # qrcode.constants.ERROR_CORRECT_L
            'box_size': 10,
            'border': 4,
        }
        
        for key, expected_value in expected_settings.items():
            self.assertIn(key, self.qr_generator.qr_settings)
            if key != 'error_correction':  # Skip error_correction as it's an enum
                self.assertEqual(self.qr_generator.qr_settings[key], expected_value)
                
    def test_generate_qr_code_basic(self):
        """Test basic QR code generation"""
        test_data = "Hello, World!"
        
        qr_bytes = self.qr_generator.generate_qr_code(test_data)
        
        # Should return bytes
        self.assertIsInstance(qr_bytes, bytes)
        
        # Should be non-empty
        self.assertTrue(len(qr_bytes) > 0)
        
        # Should start with PNG signature (if default format is PNG)
        png_signature = b'\x89PNG\r\n\x1a\n'
        self.assertTrue(qr_bytes.startswith(png_signature))
        
    def test_generate_qr_code_different_formats(self):
        """Test QR code generation with different formats"""
        test_data = "Format test"
        
        # Test PNG format
        png_bytes = self.qr_generator.generate_qr_code(test_data, 'PNG')
        self.assertTrue(png_bytes.startswith(b'\x89PNG'))
        
        # Test JPEG format
        jpeg_bytes = self.qr_generator.generate_qr_code(test_data, 'JPEG')
        self.assertTrue(jpeg_bytes.startswith(b'\xff\xd8\xff'))
        
        # Different formats should produce different outputs
        self.assertNotEqual(png_bytes, jpeg_bytes)
        
    def test_generate_qr_code_empty_data(self):
        """Test QR code generation with empty data"""
        qr_bytes = self.qr_generator.generate_qr_code("")
        
        # Should still generate a valid QR code
        self.assertIsInstance(qr_bytes, bytes)
        self.assertTrue(len(qr_bytes) > 0)
        
    def test_generate_qr_code_large_data(self):
        """Test QR code generation with large data"""
        large_data = "x" * 1000  # Large string
        
        qr_bytes = self.qr_generator.generate_qr_code(large_data)
        
        # Should handle large data
        self.assertIsInstance(qr_bytes, bytes)
        self.assertTrue(len(qr_bytes) > 0)
        
    def test_generate_address_qr(self):
        """Test generating QR code for address information"""
        qr_base64 = self.qr_generator.generate_address_qr(self.test_address_info)
        
        # Should return base64 string
        self.assertIsInstance(qr_base64, str)
        
        # Should be valid base64
        try:
            decoded = base64.b64decode(qr_base64)
            self.assertTrue(len(decoded) > 0)
        except Exception as e:
            self.fail(f"Invalid base64 string: {e}")
            
        # Decoded should be valid PNG
        decoded = base64.b64decode(qr_base64)
        png_signature = b'\x89PNG\r\n\x1a\n'
        self.assertTrue(decoded.startswith(png_signature))
        
    def test_generate_contact_qr(self):
        """Test generating QR code for contact information"""
        qr_base64 = self.qr_generator.generate_contact_qr(self.test_user_info)
        
        # Should return base64 string
        self.assertIsInstance(qr_base64, str)
        
        # Should be valid base64
        try:
            decoded = base64.b64decode(qr_base64)
            self.assertTrue(len(decoded) > 0)
        except Exception as e:
            self.fail(f"Invalid base64 string: {e}")
            
    def test_generate_address_qr_data_structure(self):
        """Test that address QR contains correct data structure"""
        # We can't easily decode the QR code content in tests, but we can
        # verify that the method uses the expected data structure
        original_generate_qr_code = self.qr_generator.generate_qr_code
        
        captured_data = None
        
        def mock_generate_qr_code(data, format='PNG'):
            nonlocal captured_data
            captured_data = data
            return original_generate_qr_code(data, format)
            
        self.qr_generator.generate_qr_code = mock_generate_qr_code
        
        self.qr_generator.generate_address_qr(self.test_address_info)
        
        # Check that captured data contains expected structure
        self.assertIn('url', captured_data)
        self.assertIn('type', captured_data)
        self.assertIn('social_site', captured_data)
        self.assertIn('timestamp', captured_data)
        self.assertIn(self.test_address_info['url'], captured_data)
        
    def test_generate_contact_qr_data_structure(self):
        """Test that contact QR contains correct data structure"""
        original_generate_qr_code = self.qr_generator.generate_qr_code
        
        captured_data = None
        
        def mock_generate_qr_code(data, format='PNG'):
            nonlocal captured_data
            captured_data = data
            return original_generate_qr_code(data, format)
            
        self.qr_generator.generate_qr_code = mock_generate_qr_code
        
        self.qr_generator.generate_contact_qr(self.test_user_info)
        
        # Check that captured data contains expected structure
        self.assertIn('name', captured_data)
        self.assertIn('site_url', captured_data)
        self.assertIn('public_key', captured_data)
        self.assertIn('type', captured_data)
        self.assertIn('contact_card', captured_data)
        self.assertIn(self.test_user_info['name'], captured_data)
        
    def test_generate_qr_with_special_characters(self):
        """Test QR generation with special characters"""
        special_data = "Hello! @#$%^&*()_+-=[]{}|;':\",./<>?"
        
        qr_bytes = self.qr_generator.generate_qr_code(special_data)
        
        # Should handle special characters without error
        self.assertIsInstance(qr_bytes, bytes)
        self.assertTrue(len(qr_bytes) > 0)
        
    def test_generate_qr_with_unicode(self):
        """Test QR generation with unicode characters"""
        unicode_data = "Hello 世界 🌍 Привет"
        
        qr_bytes = self.qr_generator.generate_qr_code(unicode_data)
        
        # Should handle unicode characters
        self.assertIsInstance(qr_bytes, bytes)
        self.assertTrue(len(qr_bytes) > 0)
        
    def test_multiple_qr_generation_consistency(self):
        """Test that generating the same QR multiple times gives consistent results"""
        test_data = "Consistency test"
        
        qr1 = self.qr_generator.generate_qr_code(test_data)
        qr2 = self.qr_generator.generate_qr_code(test_data)
        
        # Should be identical
        self.assertEqual(qr1, qr2)
        
    def test_different_data_different_qr(self):
        """Test that different data produces different QR codes"""
        data1 = "First data set"
        data2 = "Second data set"
        
        qr1 = self.qr_generator.generate_qr_code(data1)
        qr2 = self.qr_generator.generate_qr_code(data2)
        
        # Should be different
        self.assertNotEqual(qr1, qr2)
        
    def test_address_qr_with_missing_fields(self):
        """Test address QR generation with missing fields"""
        incomplete_address = {
            'url': 'http://192.168.1.100:8080'
            # Missing timestamp and id
        }
        
        # Should handle missing fields gracefully
        qr_base64 = self.qr_generator.generate_address_qr(incomplete_address)
        self.assertIsInstance(qr_base64, str)
        
        # Should be valid base64
        try:
            decoded = base64.b64decode(qr_base64)
            self.assertTrue(len(decoded) > 0)
        except Exception as e:
            self.fail(f"Failed to handle missing fields: {e}")
            
    def test_contact_qr_with_missing_fields(self):
        """Test contact QR generation with missing fields"""
        incomplete_contact = {
            'name': 'John Doe'
            # Missing other fields
        }
        
        # Should handle missing fields gracefully
        qr_base64 = self.qr_generator.generate_contact_qr(incomplete_contact)
        self.assertIsInstance(qr_base64, str)
        
        # Should be valid base64
        try:
            decoded = base64.b64decode(qr_base64)
            self.assertTrue(len(decoded) > 0)
        except Exception as e:
            self.fail(f"Failed to handle missing fields: {e}")

if __name__ == '__main__':
    # Skip tests that require qrcode if it's not available
    try:
        import qrcode
        from PIL import Image
    except ImportError:
        print("Skipping QR generator tests - qrcode and/or PIL not available")
        sys.exit(0)
        
    unittest.main()
