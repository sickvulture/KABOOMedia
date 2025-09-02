# Decentralized Social Media Platform

A privacy-first, decentralized social media platform that you own and control. Built with Python, focusing on security, simplicity, and user autonomy.

## ✨ Key Features

- **🔒 Privacy-First**: All your data stays on your device, encrypted at rest
- **🌐 Decentralized**: No central servers - connect directly with friends
- **🔧 Self-Hosted**: Run your own social space on your computer
- **🔐 Secure**: AES-256 encryption and sandboxed file system
- **🎯 Simple**: Easy setup with minimal dependencies
- **⚡ Local-First**: Works offline, syncs when connected

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd decentralized_social

# Run the complete deployment script (recommended)
python deploy.py

# OR run individual setup steps:
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run setup
python setup.py

# 3. Follow the setup wizard to create your first user
```

### 2. Launch Your Social Space

```bash
# Option 1: Use main application
python main.py

# Option 2: Use launch script  
python launch.py

# Option 3: Use deployment script start
python scripts/start.py
```

Your social space will be available at `http://localhost:8080`

### 3. Verify Installation

```bash
# Run system diagnostics
python system_status.py

# Set up test files (first time only)
python test_file_setup.py

# Run tests to verify everything works
python run_tests.py

# Check CLI functionality
python scripts/cli.py
(dsm) status
(dsm) quit
```

### 4. Share Your Address

- Visit the "Addresses" tab in the web interface
- Share your local network address with friends
- They can visit your URL to connect with you

## 📋 System Requirements

- **Python 3.8 or higher**
- **Operating System**: Windows, macOS, or Linux
- **Memory**: 256MB RAM minimum
- **Storage**: 100MB for application + your content
- **Network**: Local network access (internet optional)

## 🏗️ Project Structure

```
decentralized_social/
├── core/                   # Core application components
│   ├── encryption.py       # AES-256 encryption engine
│   ├── storage.py          # Sandboxed file storage
│   ├── web_server.py       # Built-in HTTP server
│   ├── p2p_network.py      # Peer-to-peer networking
│   └── nat_traversal.py    # NAT traversal utilities
├── database/               # Data storage layer
│   ├── local_db.py         # SQLite database management
│   ├── models.py           # Data models
│   └── migrations.py       # Database schema updates
├── site_generator/         # Dynamic web page generation
│   ├── template_engine.py  # HTML template system
│   ├── address_manager.py  # Dynamic address generation
│   └── qr_generator.py     # QR code generation
├── ui/                     # User interfaces
│   ├── web_interface.py    # Web API and interface
│   ├── cli_interface.py    # Command-line interface
│   └── web_frontend.html   # Web UI (HTML/CSS/JS)
├── utils/                  # Utility modules
│   ├── crypto_utils.py     # Cryptographic utilities
│   ├── network_utils.py    # Network discovery
│   ├── file_utils.py       # File handling
│   └── config.py           # Configuration management
├── tests/                  # Test suite
├── main.py                 # Main application entry point
├── setup.py                # Setup and installation script
├── deploy.py               # Complete deployment script
├── system_status.py        # System diagnostics
├── run_tests.py           # Test runner
├── launch.py               # Convenient launch script
```

## 🎮 Usage Guide

### Web Interface

1. **Open your browser** to `http://localhost:8080`
2. **Create posts** in the Feed tab
3. **View your profile** in the Profile tab
4. **Manage connections** in the Connections tab
5. **Share addresses** from the Addresses tab

### Command Line Interface

```bash
# Start the CLI (multiple ways)
python scripts/cli.py
# OR
python -m ui.cli_interface
# OR use the CLI artifact directly

# Common commands
(dsm) status              # Show system status
(dsm) post "Hello!"       # Create a post
(dsm) posts               # List public posts
(dsm) posts mine          # List your posts
(dsm) profile             # Show your profile
(dsm) connections         # Manage connections
(dsm) server start        # Start web server
(dsm) backup create       # Create a backup
(dsm) help                # Show all commands
(dsm) quit                # Exit CLI
```

### System Diagnostics

```bash
# Run comprehensive system diagnostics
python system_status.py

# Save diagnostic report
python system_status.py --save

# Quick status check
python system_status.py --quiet
```

### Configuration

Edit `config.json` to customize settings:

```json
{
  "web_port": 8080,
  "p2p_port": 9999,
  "storage_path": "./user_data",
  "enable_encryption": true,
  "max_connections": 50
}
```

## 🔧 Advanced Usage

### Connecting with Friends

1. **Share your address**: Go to Addresses tab, copy your network URL
2. **Visit their space**: Enter their URL in your browser
3. **Send connection request**: Use the web interface or CLI
4. **Accept connections**: Manage incoming requests

### Data Management

```bash
# Create backups
python -m ui.cli_interface
(dsm) backup create my_backup

# View data statistics  
(dsm) status

# Export data (coming in Phase 2)
```

### Network Configuration

- **Port forwarding**: For internet access, forward ports 8080 and 9999
- **Firewall**: Allow incoming connections on your configured ports
- **UPnP**: Enabled by default for automatic port forwarding

## 🧪 Testing

Run the comprehensive test suite:

```bash
# First-time setup: Create test files
python test_file_setup.py

# Then run all available tests
python run_tests.py

# The test runner will automatically:
# - Check dependencies
# - Run component tests (always available)
# - Run database tests (if test_database.py exists)
# - Run web interface tests (if test_web_interface.py exists)  
# - Run integration tests (always available)

# Run individual test components:
python -c "from run_tests import run_component_tests; run_component_tests()"

# Run system diagnostics
python system_status.py
```

**Note**: The `test_file_setup.py` script creates the individual test files needed by the test runner. Run it once after installation.

## 🔐 Security Features

- **AES-256 Encryption**: All data encrypted at rest
- **Sandboxed Storage**: Prevents directory traversal attacks
- **Input Validation**: All inputs sanitized and validated
- **Secure Defaults**: Privacy-first configuration
- **No Tracking**: No analytics, telemetry, or tracking

## 🛠️ Development

### Adding Features

1. **Core functionality**: Add to `core/` directory
2. **Database changes**: Update `database/models.py` and `local_db.py`
3. **Web API**: Extend `ui/web_interface.py`
4. **Frontend**: Modify `ui/web_frontend.html`
5. **Tests**: Add tests in `tests/` directory

### Architecture Principles

- **Modular Design**: Each component is independently testable
- **Minimal Dependencies**: Leverage Python standard library
- **Security First**: All features designed with security in mind
- **Local First**: Prioritize local functionality over network features
- **Privacy Focused**: No data collection or external dependencies

## 📜 License

This project is licensed under the GNU General Public License v3.0. See the [LICENSE](LICENSE) file for details.

### Why GPL v3?

- **Copyleft**: Ensures the software remains free and open source
- **User Freedom**: Protects your right to modify and redistribute
- **No Proprietary Forks**: Prevents creation of closed-source versions
- **Community Driven**: Encourages collaborative development

## 🗺️ Roadmap

### ✅ Phase 1 - Core Implementation (Completed)
- [x] Local database and storage
- [x] Web interface and API
- [x] Post creation and viewing  
- [x] User profiles and connections
- [x] Command-line interface
- [x] Comprehensive test suite

### 🔄 Phase 2 - P2P Features (Next)
- [ ] Message synchronization between peers
- [ ] Peer discovery mechanisms
- [ ] Distributed content sharing
- [ ] Offline message queuing

### 🔄 Phase 3 - Advanced Features
- [ ] Media handling (images, videos)
- [ ] Advanced NAT traversal (STUN/TURN)
- [ ] Mobile app interfaces
- [ ] Plugin system

### 🔄 Phase 4 - Polish
- [ ] Performance optimization
- [ ] Enhanced UI/UX
- [ ] Documentation and tutorials
- [ ] Packaging and distribution

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Write tests** for your changes
4. **Ensure tests pass**: `python run_tests.py`
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open a Pull Request**

### Development Setup

```bash
# Clone your fork
git clone <your-fork-url>
cd decentralized_social

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install development dependencies
pip install -r requirements.txt
pip install pytest pytest-cov

# Run tests to verify setup
python run_tests.py
```

## 📚 Documentation

- **User Guide**: See this README
- **API Documentation**: Available at `/api/docs` when server is running
- **Architecture Guide**: See `docs/architecture.md` (coming soon)
- **Developer Guide**: See `docs/development.md` (coming soon)

## 🐛 Troubleshooting

### Diagnostic Tools

**Run System Diagnostics First:**
```bash
# Comprehensive system check
python system_status.py

# This will check:
# - Python version and environment
# - Dependencies and imports
# - Configuration files
# - Database integrity
# - Network connectivity
# - Storage permissions
# - Security settings
# - Performance metrics
```

### Common Issues

**"Module not found" errors**
```bash
# Install dependencies
python setup.py
# Or manually
pip install -r requirements.txt
```

**"Port already in use"**
```bash
# Change port in config.json
{
  "web_port": 8081,
  "p2p_port": 9998
}
```

**"Database locked"**
```bash
# Stop all instances
pkill -f main.py
# Restart
python main.py
```

**Can't connect to friend's space**
- Ensure you're on the same network
- Check firewall settings
- Verify the address is correct
- Try the CLI: `(dsm) connections add <user_id>`

### Getting Help

1. **Run Diagnostics**: `python system_status.py`
2. **Check the logs**: Look in `logs/` directory
3. **Run tests**: `python run_tests.py`
4. **CLI diagnostics**: `(dsm) status` and `(dsm) server status`
5. **Test network**: `(dsm) server addresses`
6. **Create an issue**: Open a GitHub issue with diagnostic report

## 🙏 Acknowledgments

- **Python Community**: For the excellent standard library
- **Cryptography Library**: For secure encryption implementation
- **SQLite**: For reliable local database storage
- **Open Source Community**: For inspiration and tools

## 📞 Support

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Check this README and inline documentation  
- **Community**: Join discussions in GitHub Discussions
- **Security Issues**: Email security@[domain] for responsible disclosure

---

**Built with ❤️ for privacy, freedom, and decentralization.**

*Your data. Your rules. Your social space.*
