import unittest
import tempfile
import shutil
import os
from pathlib import Path
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from site_generator.template_engine import SiteTemplateEngine

class TestSiteTemplateEngine(unittest.TestCase):
    
    def setUp(self):
        """Set up test fixtures"""
        self.temp_dir = tempfile.mkdtemp()
        self.template_engine = SiteTemplateEngine(self.temp_dir)
        
        # Test data
        self.test_user_data = {
            'name': 'John Doe',
            'bio': 'A test user for the decentralized social platform'
        }
        
        self.test_posts = [
            {
                'content': 'This is my first post!',
                'timestamp': '2025-01-15 10:30:00',
                'privacy_level': 'public',
                'media': [],
                'comments': [
                    {
                        'author': 'Alice',
                        'content': 'Great post!',
                        'timestamp': '2025-01-15 11:00:00'
                    }
                ]
            },
            {
                'content': 'Another exciting post with media',
                'timestamp': '2025-01-16 14:20:00',
                'privacy_level': 'friends',
                'media': [
                    {
                        'url': '/media/photo1.jpg',
                        'description': 'A beautiful sunset'
                    }
                ],
                'comments': []
            }
        ]
        
    def tearDown(self):
        """Clean up test fixtures"""
        if os.path.exists(self.temp_dir):
            shutil.rmtree(self.temp_dir)
            
    def test_initialization(self):
        """Test template engine initialization"""
        self.assertTrue(os.path.exists(self.temp_dir))
        self.assertIsNotNone(self.template_engine.env)
        self.assertEqual(str(self.template_engine.template_dir), self.temp_dir)
        
    def test_default_templates_creation(self):
        """Test that default templates are created"""
        expected_templates = ['base.html', 'index.html']
        
        for template in expected_templates:
            template_path = Path(self.temp_dir) / template
            self.assertTrue(template_path.exists())
            
            # Verify template content is not empty
            with open(template_path, 'r') as f:
                content = f.read()
                self.assertTrue(len(content) > 0)
                
    def test_default_templates_not_overwritten(self):
        """Test that existing templates are not overwritten"""
        # Create a custom template
        custom_content = "<html><body>Custom template</body></html>"
        custom_template_path = Path(self.temp_dir) / 'base.html'
        
        with open(custom_template_path, 'w') as f:
            f.write(custom_content)
            
        # Create new engine - should not overwrite existing template
        new_engine = SiteTemplateEngine(self.temp_dir)
        
        with open(custom_template_path, 'r') as f:
            content = f.read()
            self.assertEqual(content, custom_content)
            
    def test_render_page_basic(self):
        """Test basic page rendering"""
        # Create a simple test template
        test_template = "<html><head><title>{{ title }}</title></head><body><h1>{{ heading }}</h1></body></html>"
        test_template_path = Path(self.temp_dir) / 'test.html'
        
        with open(test_template_path, 'w') as f:
            f.write(test_template)
            
        # Render the template
        context = {
            'title': 'Test Page',
            'heading': 'Welcome to Test Page'
        }
        
        rendered = self.template_engine.render_page('test.html', context)
        
        self.assertIn('Test Page', rendered)
        self.assertIn('Welcome to Test Page', rendered)
        self.assertIn('<title>Test Page</title>', rendered)
        
    def test_generate_user_site(self):
        """Test generating complete user site"""
        rendered_site = self.template_engine.generate_user_site(
            self.test_user_data, 
            self.test_posts
        )
        
        # Check that user data is included
        self.assertIn(self.test_user_data['name'], rendered_site)
        self.assertIn(self.test_user_data['bio'], rendered_site)
        
        # Check that posts are included
        for post in self.test_posts:
            self.assertIn(post['content'], rendered_site)
            self.assertIn(post['privacy_level'], rendered_site)
            
        # Check that comments are included
        self.assertIn('Alice', rendered_site)
        self.assertIn('Great post!', rendered_site)
        
        # Check that media is handled
        self.assertIn('/media/photo1.jpg', rendered_site)
        self.assertIn('A beautiful sunset', rendered_site)
        
    def test_template_inheritance(self):
        """Test that template inheritance works properly"""
        # The default index.html extends base.html
        rendered_site = self.template_engine.generate_user_site(
            self.test_user_data, 
            self.test_posts
        )
        
        # Should contain elements from base template
        self.assertIn('<!DOCTYPE html>', rendered_site)
        self.assertIn('<html lang="en">', rendered_site)
        self.assertIn('<meta charset="UTF-8">', rendered_site)
        self.assertIn(f"{self.test_user_data['name']}'s Social Space", rendered_site)
        
    def test_template_with_loops(self):
        """Test template rendering with loops (posts and comments)"""
        rendered_site = self.template_engine.generate_user_site(
            self.test_user_data, 
            self.test_posts
        )
        
        # Should contain multiple posts
        post_count = rendered_site.count('<div class="post">')
        self.assertEqual(post_count, len(self.test_posts))
        
        # Should contain comments section
        self.assertIn('<div class="comments">', rendered_site)
        self.assertIn('Comments (1)', rendered_site)  # First post has 1 comment
        self.assertIn('Comments (0)', rendered_site)  # Second post has 0 comments
        
    def test_template_with_conditionals(self):
        """Test template rendering with conditional blocks"""
        rendered_site = self.template_engine.generate_user_site(
            self.test_user_data, 
            self.test_posts
        )
        
        # Should show media only for posts that have media
        media_blocks = rendered_site.count('<div class="post-media">')
        posts_with_media = sum(1 for post in self.test_posts if post['media'])
        self.assertEqual(media_blocks, posts_with_media)
        
    def test_render_page_missing_template(self):
        """Test rendering with missing template file"""
        with self.assertRaises(Exception):
            self.template_engine.render_page('nonexistent.html', {})
            
    def test_render_page_with_missing_context_variables(self):
        """Test rendering with missing context variables"""
        # Create template that references undefined variable
        test_template = "<html><body>{{ undefined_variable }}</body></html>"
        test_template_path = Path(self.temp_dir) / 'missing_var.html'
        
        with open(test_template_path, 'w') as f:
            f.write(test_template)
            
        # Should render without error (Jinja2 will render empty string for undefined vars)
        rendered = self.template_engine.render_page('missing_var.html', {})
        self.assertIn('<html><body></body></html>', rendered)
        
    def test_custom_template_loading(self):
        """Test loading and using custom templates"""
        # Create a custom template
        custom_template = """
        <html>
        <head><title>{{ title }}</title></head>
        <body>
            <h1>{{ user.name }}'s Custom Page</h1>
            <p>Posts: {{ posts|length }}</p>
            <ul>
            {% for post in posts %}
                <li>{{ post.content }}</li>
            {% endfor %}
            </ul>
        </body>
        </html>
        """
        
        custom_template_path = Path(self.temp_dir) / 'custom.html'
        with open(custom_template_path, 'w') as f:
            f.write(custom_template)
            
        # Render using custom template
        context = {
            'title': 'Custom Page',
            'user': self.test_user_data,
            'posts': self.test_posts
        }
        
        rendered = self.template_engine.render_page('custom.html', context)
        
        self.assertIn('Custom Page', rendered)
        self.assertIn(f"{self.test_user_data['name']}'s Custom Page", rendered)
        self.assertIn(f'Posts: {len(self.test_posts)}', rendered)
        
        # Check that all posts are listed
        for post in self.test_posts:
            self.assertIn(f'<li>{post["content"]}</li>', rendered)
            
    def test_template_css_styling(self):
        """Test that default templates include CSS styling"""
        rendered_site = self.template_engine.generate_user_site(
            self.test_user_data, 
            self.test_posts
        )
        
        # Should contain CSS styling
        self.assertIn('<style>', rendered_site)
        self.assertIn('font-family:', rendered_site)
        self.assertIn('.post {', rendered_site)
        self.assertIn('.comments {', rendered_site)
        
    def test_empty_posts_handling(self):
        """Test handling of empty posts list"""
        rendered_site = self.template_engine.generate_user_site(
            self.test_user_data, 
            []  # Empty posts list
        )
        
        # Should still render user info
        self.assertIn(self.test_user_data['name'], rendered_site)
        self.assertIn(self.test_user_data['bio'], rendered_site)
        
        # Should not have any post divs
        self.assertNotIn('<div class="post">', rendered_site)

if __name__ == '__main__':
    # Skip tests that require jinja2 if it's not available
    try:
        import jinja2
    except ImportError:
        print("Skipping template engine tests - jinja2 not available")
        sys.exit(0)
        
    unittest.main()
