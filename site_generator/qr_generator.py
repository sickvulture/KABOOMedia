import qrcode
from io import BytesIO
import base64
from typing import Dict, Any

class QRCodeGenerator:
    def __init__(self):
        self.qr_settings = {
            'version': 1,
            'error_correction': qrcode.constants.ERROR_CORRECT_L,
            'box_size': 10,
            'border': 4,
        }
    
    def generate_qr_code(self, data: str, format: str = 'PNG') -> bytes:
        """Generate QR code for given data"""
        qr = qrcode.QRCode(**self.qr_settings)
        qr.add_data(data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="black", back_color="white")
        
        # Convert to bytes
        img_buffer = BytesIO()
        img.save(img_buffer, format=format)
        return img_buffer.getvalue()
    
    def generate_address_qr(self, address_info: Dict[str, Any]) -> str:
        """Generate QR code for site address and return as base64"""
        qr_data = {
            'url': address_info['url'],
            'type': 'social_site',
            'timestamp': address_info['timestamp']
        }
        
        qr_bytes = self.generate_qr_code(str(qr_data))
        return base64.b64encode(qr_bytes).decode('utf-8')
    
    def generate_contact_qr(self, user_info: Dict[str, Any]) -> str:
        """Generate QR code for user contact information"""
        contact_data = {
            'name': user_info.get('name'),
            'site_url': user_info.get('current_url'),
            'public_key': user_info.get('public_key'),
            'type': 'contact_card'
        }
        
        qr_bytes = self.generate_qr_code(str(contact_data))
        return base64.b64encode(qr_bytes).decode('utf-8')
