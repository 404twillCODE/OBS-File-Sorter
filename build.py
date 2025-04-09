import PyInstaller.__main__
import os
import sys
import shutil
import time

# Get the current directory
current_dir = os.path.dirname(os.path.abspath(__file__))

# Clean previous build - with error handling
print("Cleaning previous build files...")
dist_dir = os.path.join(current_dir, 'dist')
build_dir = os.path.join(current_dir, 'build')
spec_file = os.path.join(current_dir, 'OBS_File_Sorter.spec')

def safe_remove(path):
    """Safely remove a file or directory with retry logic"""
    if not os.path.exists(path):
        return
        
    max_retries = 3
    for attempt in range(max_retries):
        try:
            if os.path.isdir(path):
                shutil.rmtree(path)
            else:
                os.remove(path)
            print(f"Successfully removed: {path}")
            return
        except Exception as e:
            print(f"Attempt {attempt+1}/{max_retries} - Error removing {path}: {e}")
            time.sleep(1)  # Wait before retrying
    
    print(f"Warning: Could not remove {path}, continuing anyway")

# Try to clean previous build files
try:
    safe_remove(dist_dir)
    safe_remove(build_dir) 
    safe_remove(spec_file)
except Exception as e:
    print(f"Warning: Error during cleanup: {e}")
    print("Continuing with build anyway...")

# Define the separator based on the operating system
separator = ';' if sys.platform == 'win32' else ':'

# Ensure the config file exists
config_file = os.path.join(current_dir, 'obs_auto_sorter_config.json')
if not os.path.exists(config_file):
    # Create an empty config file if it doesn't exist
    try:
        with open(config_file, 'w') as f:
            f.write('{}')
        print(f"Created default config file: {config_file}")
    except Exception as e:
        print(f"Warning: Could not create config file: {e}")

# Ensure the icon file exists
icon_file = os.path.join(current_dir, 'icon.ico')
if not os.path.exists(icon_file):
    print("Warning: icon.ico not found!")
    icon_file = None

# Build arguments
args = [
    'file.py',  # Your main script
    '--name=OBS_File_Sorter',  # Name of the executable
    '--onefile',  # Create a single executable file
    '--noconsole',  # Don't show console window
    '--clean',  # Clean PyInstaller cache
    '--windowed',  # Windows specific: don't show console
]

# Add data files
if os.path.exists(config_file):
    args.append(f'--add-data={config_file}{separator}.')

# Add hidden imports for keyboard module
args.append('--hidden-import=keyboard')

# Add icon if it exists
if icon_file:
    args.append(f'--icon={icon_file}')

print(f"Building with arguments: {args}")

# Run PyInstaller with error handling
try:
    PyInstaller.__main__.run(args)
    print("\nBuild completed successfully!")
except Exception as e:
    print(f"\nError during build: {e}")
    print("Build failed. Please check the error messages above.") 