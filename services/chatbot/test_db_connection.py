#!/usr/bin/env python3
"""
Quick Test Runner for MongoDB Connection

This script ensures you're running the test from the correct directory
and helps debug any import issues.

Usage:
    python3 run_test.py
"""

import os
import sys

# Print current working directory for debugging
print(f"Current directory: {os.getcwd()}")
print(f"Script location: {os.path.abspath(__file__)}")

# Get the project root (where this script is located)
project_root = os.path.dirname(os.path.abspath(__file__))
print(f"Project root: {project_root}")

# Add project root to Python path
if project_root not in sys.path:
    sys.path.insert(0, project_root)

print(f"Python path: {sys.path[:3]}...")  # Show first 3 entries
print()

# Verify the app directory exists
app_dir = os.path.join(project_root, 'app')
if not os.path.exists(app_dir):
    print(f"❌ ERROR: Cannot find 'app' directory at {app_dir}")
    print("Make sure you're running this from your project root directory.")
    sys.exit(1)

# Verify settings.py exists
settings_file = os.path.join(app_dir, 'settings.py')
if not os.path.exists(settings_file):
    print(f"❌ ERROR: Cannot find 'settings.py' at {settings_file}")
    sys.exit(1)

print("✅ Project structure looks good!")
print()

# Now try to import and run the test
try:
    print("Loading environment variables...")
    from dotenv import load_dotenv
    env_path = os.path.join(project_root, '.env')
    if os.path.exists(env_path):
        load_dotenv(env_path)
        print(f"✅ Loaded .env from {env_path}")
    else:
        print(f"⚠️  No .env file found at {env_path}")
        print("   Make sure MONGODB_URI is set in your environment")
    print()
    
    print("Importing settings...")
    from app.settings import settings
    print("✅ Successfully imported settings")
    print(f"   MongoDB URI: {settings.mongodb_uri[:30]}...")  # Show first 30 chars
    print(f"   Database: {settings.mongodb_database}")
    print()
    
    print("Importing database connection...")
    from app.mcp.db_connection import check_database_health
    print("✅ Successfully imported db_connection")
    print()
    
    print("Testing database connection...")
    health = check_database_health()
    
    if health.get("connected"):
        print("✅ Successfully connected to MongoDB!")
        print(f"   Database: {health['database']}")
        print(f"   Collections found: {health.get('collections_found', [])}")
        print()
        print("🎉 Everything is working! You can now run the full test:")
        print("   python3 tests/test_db_connection.py")
    else:
        print("❌ Failed to connect to MongoDB")
        print(f"   Error: {health.get('error', 'Unknown error')}")
        print()
        print("Common issues:")
        print("1. MongoDB is not running")
        print("2. MONGODB_URI in .env is incorrect")
        print("3. Database permissions")
        
except ImportError as e:
    print(f"❌ Import Error: {e}")
    print()
    print("This usually means:")
    print("1. You're not in the project root directory")
    print("2. The 'app' directory structure is different")
    print("3. Required packages are not installed")
    print()
    print("Try:")
    print("  cd /path/to/your/project/root")
    print("  python3 run_test.py")
    sys.exit(1)
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)