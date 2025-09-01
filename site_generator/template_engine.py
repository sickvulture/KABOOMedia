import os
import json
from pathlib import Path
from typing import Dict, Any, List
from jinja2 import Environment, FileSystemLoader, Template

class SiteTemplateEngine:
    def __init__(self, template_dir: str = "templates"):
        self.template_dir = Path(template_dir)
        self.template_dir.mkdir(exist_ok=True)
        self.env = Environment(loader=FileSystemLoader(str(self.template_dir)))
        self._create_default_templates()
    
    def _create_default_templates(self):
        """Create default HTML templates"""
        default_templates = {
            'base.html': '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{ user.name }}'s Social Space</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        .post { border: 1px solid #ddd; margin: 20px 0; padding: 15px; border-radius: 5px; }
        .post-meta { color: #666; font-size: 0.9em; margin-bottom: 10px; }
        .comments { margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <header>
        <h1>{{ user.name }}'s Social Space</h1>
        <p>{{ user.bio }}</p>
    </header>
    <main>
        {% block content %}{% endblock %}
    </main>
</body>
</html>''',
            
            'index.html': '''{% extends "base.html" %}
{% block content %}
<div class="posts">
    {% for post in posts %}
    <div class="post">
        <div class="post-meta">{{ post.timestamp }} | {{ post.privacy_level }}</div>
        <div class="post-content">{{ post.content }}</div>
        {% if post.media %}
        <div class="post-media">
            {% for media in post.media %}
            <img src="{{ media.url }}" alt="{{ media.description }}" style="max-width: 100%;">
            {% endfor %}
        </div>
        {% endif %}
        <div class="comments">
            <h4>Comments ({{ post.comments|length }})</h4>
            {% for comment in post.comments %}
            <div class="comment">
                <strong>{{ comment.author }}</strong>: {{ comment.content }}
                <small>({{ comment.timestamp }})</small>
            </div>
            {% endfor %}
        </div>
    </div>
    {% endfor %}
</div>
{% endblock %}'''
        }
        
        for filename, content in default_templates.items():
            template_path = self.template_dir / filename
            if not template_path.exists():
                with open(template_path, 'w') as f:
                    f.write(content)
    
    def render_page(self, template_name: str, context: Dict[str, Any]) -> str:
        """Render a page with the given context"""
        template = self.env.get_template(template_name)
        return template.render(**context)
    
    def generate_user_site(self, user_data: Dict[str, Any], posts: List[Dict[str, Any]]) -> str:
        """Generate the main user site HTML"""
        context = {
            'user': user_data,
            'posts': posts
        }
        return self.render_page('index.html', context)
