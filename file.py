import os
import shutil
import tkinter as tk
from tkinter import filedialog, messagebox, PhotoImage, ttk
import json
import subprocess
from datetime import datetime
import platform
import threading
import time
import keyboard  # New library for hotkey detection
import sys
import logging

def resource_path(relative_path):
    """Get absolute path to resource, works for dev and for PyInstaller"""
    try:
        # PyInstaller creates a temp folder and stores path in _MEIPASS
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    
    result_path = os.path.join(base_path, relative_path)
    logger.debug(f"Resource path for {relative_path}: {result_path}")
    return result_path

# Set up logging
def setup_logging():
    try:
        log_file = "obs_sorter.log"
        logging.basicConfig(
            level=logging.DEBUG,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(log_file),
                logging.StreamHandler()
            ]
        )
        return logging.getLogger(__name__)
    except Exception as e:
        print(f"Error setting up logging: {e}")
        # Fallback basic logging configuration
        logging.basicConfig(level=logging.DEBUG)
        return logging.getLogger(__name__)

logger = setup_logging()
logger.info("Application starting...")

CONFIG_FILE = "obs_auto_sorter_config.json"


class ModernScrollbar(tk.Scrollbar):
    def __init__(self, master, **kwargs):
        super().__init__(master, **kwargs)
        self.config(
            width=10,
            borderwidth=0,
            highlightthickness=0,
            troughcolor="#1E1E1E",
            background="#3C3F41",
            activebackground="#4C5052"
        )


class OBSAutoSorterApp:
    def __init__(self, root):
        # Define fonts first
        self.fonts = {
            "title": ("Inter", 18, "bold"),
            "subtitle": ("Inter", 12, "normal"),
            "header": ("Inter", 12, "bold"),
            "body": ("Inter", 10, "normal"),
            "mono": ("Fira Code", 10, "normal")
        }

        self.root = root
        self.root.title("OBS File Sorter")
        self.root.geometry("750x450")  # Further reduced height
        self.root.resizable(False, False)  # Prevent window resizing for consistent layout
        self.root.overrideredirect(True)  # Removes default window decorations

        # Ultra-Modern Color Palette
        self.colors = {
            "background": "#121212",      # Deep, almost black background
            "surface": "#1E1E1E",         # Slightly lighter surface
            "primary": "#BB86FC",         # Vibrant purple for highlights
            "secondary": "#03DAC6",       # Teal accent color
            "text_primary": "#FFFFFF",    # Pure white text
            "text_secondary": "#B0B0B0",  # Soft gray text
            "accent": "#CF6679",          # Accent for errors and highlights
            "success": "#4CAF50",         # Green for success states
            "error": "#CF6679"            # Vibrant red for errors
        }

        # Create a custom title bar
        self.create_title_bar()

        # Main container
        self.main_frame = tk.Frame(root, bg=self.colors["background"], padx=30, pady=30)
        self.main_frame.pack(expand=True, fill=tk.BOTH)

        # Configurations
        self.configurations = {
            "source_folder": "",
            "backtrack_folder": "",
            "replay_folder": "",
            "recording_folder": "",
            "vault_destination_folder": "",
            "auto_delete": False,
            "delete_length_minutes": 5,
            "auto_delete_folders": False,
            "delete_length_days": 14
        }

        # Load configurations from JSON
        self.load_configurations()

        # Create UI Components
        self.create_header()
        self.create_folder_sections()
        self.create_action_buttons()

        # Add hover and click effects
        self.add_hover_effects()

        # Start the hotkey listener in a separate thread
        self.hotkey_thread = threading.Thread(target=self.listen_for_hotkeys, daemon=True)
        self.hotkey_thread.start()

        # Start auto-delete thread if enabled
        self.start_auto_delete_thread()

        # Start old folder delete thread if enabled
        self.start_old_folder_delete_thread()
        
        # Start vault monitoring thread
        self.start_vault_monitor_thread()

        # Bind window close event
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)

    def create_title_bar(self):
        # Custom title bar with minimize, maximize, close buttons
        title_bar = tk.Frame(self.root, bg=self.colors["surface"], height=30)
        title_bar.pack(fill=tk.X)
        title_bar.pack_propagate(False)

        # App title
        title_label = tk.Label(
            title_bar, 
            text="OBS File Sorter", 
            bg=self.colors["surface"], 
            fg=self.colors["text_primary"], 
            font=self.fonts["subtitle"]
        )
        title_label.pack(side=tk.LEFT, padx=10)

        # Window control buttons
        control_frame = tk.Frame(title_bar, bg=self.colors["surface"])
        control_frame.pack(side=tk.RIGHT)

        # Minimize button
        minimize_btn = tk.Button(
            control_frame, 
            text="—", 
            bg=self.colors["surface"], 
            fg=self.colors["text_secondary"],
            font=("Arial", 10),
            borderwidth=0,
            command=self.root.iconify
        )
        minimize_btn.pack(side=tk.LEFT, padx=5)

        # Close button
        close_btn = tk.Button(
            control_frame, 
            text="✕", 
            bg=self.colors["surface"], 
            fg=self.colors["accent"],
            font=("Arial", 10, "bold"),
            borderwidth=0,
            command=self.root.quit
        )
        close_btn.pack(side=tk.LEFT, padx=5)

        # Make title bar draggable
        def start_move(event):
            self.root.x = event.x
            self.root.y = event.y

        def stop_move(event):
            self.root.x = None
            self.root.y = None

        def do_move(event):
            deltax = event.x - self.root.x
            deltay = event.y - self.root.y
            x = self.root.winfo_x() + deltax
            y = self.root.winfo_y() + deltay
            self.root.geometry(f"+{x}+{y}")

        title_bar.bind("<ButtonPress-1>", start_move)
        title_bar.bind("<ButtonRelease-1>", stop_move)
        title_bar.bind("<B1-Motion>", do_move)

    def create_header(self):
        # Modern header with gradient and subtle animation
        header_frame = tk.Frame(self.main_frame, bg=self.colors["background"])
        header_frame.pack(fill=tk.X, pady=(0, 30))
        
        # Animated title with gradient-like effect
        title_label = tk.Label(
            header_frame, 
            text="OBS File Sorter", 
            font=self.fonts["title"], 
            fg=self.colors["primary"], 
            bg=self.colors["background"]
        )
        title_label.pack()
        
        subtitle_label = tk.Label(
            header_frame, 
            text="Streamline Your Recording Workflow", 
            font=self.fonts["subtitle"], 
            fg=self.colors["text_secondary"], 
            bg=self.colors["background"]
        )
        subtitle_label.pack()

    def create_folder_sections(self):
        # Folder selection sections with advanced styling
        folders = [
            ("Source Folder", self.browse_source_folder, "source_folder"),
            ("Backtrack Folder", self.browse_backtrack_folder, "backtrack_folder"),
            ("Replay Folder", self.browse_replay_folder, "replay_folder"),
            ("Recording Folder", self.browse_recording_folder, "recording_folder"),
            ("Vault Destination Folder", self.browse_vault_destination_folder, "vault_destination_folder")
        ]

        for label_text, browse_command, config_key in folders:
            folder_frame = tk.Frame(self.main_frame, bg=self.colors["background"])
            folder_frame.pack(fill=tk.X, pady=5)

            # Floating label with modern typography
            label = tk.Label(
                folder_frame, 
                text=label_text, 
                font=self.fonts["header"], 
                fg=self.colors["text_primary"], 
                bg=self.colors["background"], 
                anchor='w', 
                width=20
            )
            label.pack(side=tk.LEFT)

            # Entry with modern, flat design
            entry = tk.Entry(
                folder_frame, 
                font=self.fonts["mono"], 
                bg=self.colors["surface"], 
                fg=self.colors["text_primary"], 
                insertbackground=self.colors["primary"],
                width=40,
                relief=tk.FLAT,
                highlightthickness=1,
                highlightcolor=self.colors["primary"],
                highlightbackground=self.colors["surface"]
            )
            entry.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=10)
            setattr(self, f"{config_key}_entry", entry)

            # Browse button with modern styling
            browse_btn = tk.Button(
                folder_frame, 
                text="Browse", 
                command=browse_command,
                font=self.fonts["body"],
                bg=self.colors["secondary"], 
                fg=self.colors["background"],
                activebackground=self.colors["primary"],
                relief=tk.FLAT,
                padx=10,
                borderwidth=0
            )
            browse_btn.pack(side=tk.LEFT)

            # Pre-fill the folder entries
            entry.insert(0, self.configurations[config_key])

    def create_action_buttons(self):
        # Action buttons section with advanced styling
        action_frame = tk.Frame(self.main_frame, bg=self.colors["background"])
        action_frame.pack(fill=tk.X, pady=(20, 0))

        # Create a frame for buttons to place them side by side
        button_frame = tk.Frame(action_frame, bg=self.colors["background"])
        button_frame.pack(expand=True, fill=tk.X)

        # Gradient-like sort button
        sort_button = tk.Button(
            button_frame, 
            text="Sort Clips", 
            command=self.run_sorter,
            font=self.fonts["header"],
            bg=self.colors["primary"], 
            fg=self.colors["background"], 
            activebackground=self.colors["secondary"],
            relief=tk.FLAT,
            padx=20,
            pady=10,
            borderwidth=0
        )
        sort_button.pack(side=tk.LEFT, expand=True, padx=10)

        # Settings button
        settings_button = tk.Button(
            button_frame, 
            text="Settings", 
            command=self.create_settings_menu,
            font=self.fonts["header"],
            bg=self.colors["secondary"], 
            fg=self.colors["background"], 
            activebackground=self.colors["primary"],
            relief=tk.FLAT,
            padx=20,
            pady=10,
            borderwidth=0
        )
        settings_button.pack(side=tk.LEFT, expand=True, padx=10)

        # Status label with modern typography
        self.status_label = tk.Label(
            action_frame, 
            text="", 
            font=self.fonts["body"], 
            fg=self.colors["text_secondary"], 
            bg=self.colors["background"]
        )
        self.status_label.pack(pady=(10, 0))

    def add_hover_effects(self):
        # Add hover effects to buttons and entries
        def on_enter(e, widget, hover_bg):
            widget.config(bg=hover_bg)

        def on_leave(e, widget, original_bg):
            widget.config(bg=original_bg)

        # Collect all buttons
        buttons = [
            btn for btn in self.main_frame.winfo_children() 
            if isinstance(btn, tk.Button)
        ]

        for button in buttons:
            button.bind("<Enter>", lambda e, btn=button: on_enter(e, btn, self.colors["secondary"]))
            button.bind("<Leave>", lambda e, btn=button: on_leave(e, btn, self.colors["primary"]))

    def browse_source_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.source_folder_entry.delete(0, tk.END)
            self.source_folder_entry.insert(0, folder)
            self.configurations["source_folder"] = folder
            self.save_configurations()

    def browse_backtrack_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.backtrack_folder_entry.delete(0, tk.END)
            self.backtrack_folder_entry.insert(0, folder)
            self.configurations["backtrack_folder"] = folder
            self.save_configurations()

    def browse_replay_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.replay_folder_entry.delete(0, tk.END)
            self.replay_folder_entry.insert(0, folder)
            self.configurations["replay_folder"] = folder
            self.save_configurations()

    def browse_recording_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.recording_folder_entry.delete(0, tk.END)
            self.recording_folder_entry.insert(0, folder)
            self.configurations["recording_folder"] = folder
            self.save_configurations()

    def browse_vault_destination_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.vault_destination_folder_entry.delete(0, tk.END)
            self.vault_destination_folder_entry.insert(0, folder)
            self.configurations["vault_destination_folder"] = folder
            self.save_configurations()

    def save_configurations(self):
        """Save configurations to a JSON file."""
        try:
            # Always save to the local directory
            config_path = os.path.join(os.path.abspath("."), CONFIG_FILE)
            logger.debug(f"Saving configuration to: {config_path}")
            with open(config_path, "w") as config_file:
                json.dump(self.configurations, config_file, indent=4)
            logger.info("Configuration saved successfully")
        except Exception as e:
            logger.error(f"Error saving configuration file: {e}", exc_info=True)
            print(f"Error saving configuration file: {e}")

    def load_configurations(self):
        """Load configurations from a JSON file."""
        default_configurations = {
            "source_folder": "",
            "backtrack_folder": "",
            "replay_folder": "",
            "recording_folder": "",
            "vault_destination_folder": "",
            "auto_delete": False,
            "delete_length_minutes": 5,  # Default to 5 minutes
            "auto_delete_folders": False,  # New configuration for folder deletion
            "delete_length_days": 14  # New configuration for folder deletion days
        }

        try:
            # Try to load from executable directory first
            local_config = os.path.join(os.path.abspath("."), CONFIG_FILE)
            bundled_config = resource_path(CONFIG_FILE)
            
            logger.debug(f"Looking for config file at: {local_config}")
            logger.debug(f"Alternative path: {bundled_config}")
            
            # Prioritize local config over bundled
            if os.path.exists(local_config):
                config_path = local_config
                logger.info(f"Using local configuration file: {local_config}")
            elif os.path.exists(bundled_config):
                config_path = bundled_config
                logger.info(f"Using bundled configuration file: {bundled_config}")
            else:
                logger.warning("No configuration file found, creating default")
                self.configurations = default_configurations
                self.save_configurations()
                return
                
            with open(config_path, "r") as config_file:
                loaded_config = json.load(config_file)
                logger.debug(f"Loaded configuration: {loaded_config}")
                self.configurations.update({**default_configurations, **loaded_config})
                
        except json.JSONDecodeError as e:
            logger.error(f"Error parsing JSON in configuration file: {e}", exc_info=True)
            self.configurations = default_configurations
            self.save_configurations()
        except Exception as e:
            logger.error(f"Error loading configuration file: {e}", exc_info=True)
            print(f"Error reading configuration file: {e}")
            self.configurations = default_configurations
            self.save_configurations()

    def create_vault_folders(self, target_folder):
        """Create The Vault folder and its subfolders in the target directory."""
        vault_folder = os.path.join(target_folder, "The Vault")
        
        # Create main vault folder
        try:
            os.makedirs(vault_folder, exist_ok=True)
            logger.debug(f"Created/verified vault folder: {vault_folder}")
            
            # Create subfolders
            subfolders = ["Fortnite", "R.E.P.O", "Random"]
            for subfolder in subfolders:
                subfolder_path = os.path.join(vault_folder, subfolder)
                os.makedirs(subfolder_path, exist_ok=True)
                logger.debug(f"Created/verified vault subfolder: {subfolder_path}")
                
            return True
        except Exception as e:
            logger.error(f"Error creating vault folders: {e}", exc_info=True)
            return False

    def sync_vault_files(self, target_date_folder):
        """Sync files from The Vault folders to the vault destination folder."""
        vault_destination = self.configurations.get("vault_destination_folder", "")
        if not vault_destination or not os.path.exists(vault_destination):
            logger.warning(f"Vault destination folder not set or doesn't exist: {vault_destination}")
            return
        
        vault_folder = os.path.join(target_date_folder, "The Vault")
        if not os.path.exists(vault_folder):
            logger.warning(f"Vault folder doesn't exist: {vault_folder}")
            return
            
        # Ensure destination vault folders exist
        dest_vault_folders = {
            "Fortnite": os.path.join(vault_destination, "Fortnite"),
            "R.E.P.O": os.path.join(vault_destination, "R.E.P.O"),
            "Random": os.path.join(vault_destination, "Random")
        }
        
        for folder_name, folder_path in dest_vault_folders.items():
            os.makedirs(folder_path, exist_ok=True)
            
        # Check for files in each vault subfolder and sync them
        subfolders = ["Fortnite", "R.E.P.O", "Random"]
        for subfolder in subfolders:
            source_folder = os.path.join(vault_folder, subfolder)
            dest_folder = dest_vault_folders[subfolder]
            
            if not os.path.exists(source_folder):
                continue
                
            # Copy all files from source to destination
            for filename in os.listdir(source_folder):
                if not filename.lower().endswith('.mp4'):
                    continue
                    
                source_file = os.path.join(source_folder, filename)
                dest_file = os.path.join(dest_folder, filename)
                
                try:
                    # Only copy if file doesn't already exist in destination
                    if not os.path.exists(dest_file):
                        shutil.copy2(source_file, dest_file)
                        logger.info(f"Synced vault file: {source_file} -> {dest_file}")
                except Exception as e:
                    logger.error(f"Error syncing vault file {filename}: {e}", exc_info=True)

    def run_sorter(self):
        logger.info("Starting sorting process...")
        
        # Update status
        self.status_label.config(text="Sorting in progress...")
        self.root.update()
        
        source_folder = self.source_folder_entry.get()
        backtrack_folder = self.backtrack_folder_entry.get()
        replay_folder = self.replay_folder_entry.get()
        recording_folder = self.recording_folder_entry.get()
        
        # Get auto-delete settings from configurations
        auto_delete = self.configurations.get("auto_delete", False)
        delete_length_minutes = self.configurations.get("delete_length_minutes", 5)
        delete_length_seconds = delete_length_minutes * 60

        logger.debug(f"Source folder: {source_folder}")
        logger.debug(f"Backtrack folder: {backtrack_folder}")
        logger.debug(f"Replay folder: {replay_folder}")
        logger.debug(f"Recording folder: {recording_folder}")
        logger.debug(f"Auto delete enabled: {auto_delete}")
        logger.debug(f"Delete length set to {delete_length_minutes} minutes")

        if not all([source_folder, backtrack_folder, replay_folder, recording_folder]):
            logger.error("One or more folders not selected")
            messagebox.showerror("Error", "Please select all required folders.")
            self.status_label.config(text="Error: Missing folder selection")
            return

        if not os.path.exists(source_folder):
            logger.error(f"Source folder does not exist: {source_folder}")
            messagebox.showerror("Error", f"Source folder does not exist: {source_folder}")
            self.status_label.config(text="Error: Source folder not found")
            return

        try:
            files = os.listdir(source_folder)
            logger.info(f"Found {len(files)} files in source folder")
            
            # Filter for .mp4 files
            mp4_files = [f for f in files if f.lower().endswith('.mp4')]
            logger.info(f"Found {len(mp4_files)} .mp4 files")
            
            if not mp4_files:
                logger.info("No .mp4 files found to process")
                messagebox.showinfo("Info", "No .mp4 files found to process")
                self.status_label.config(text="No .mp4 files found")
                return
                
        except Exception as e:
            logger.error(f"Error reading source folder: {e}")
            messagebox.showerror("Error", f"Could not read source folder: {str(e)}")
            self.status_label.config(text="Error: Couldn't read source folder")
            return

        # Variable to track if we processed any files successfully
        files_processed = 0
        files_skipped = 0
        
        # Track created date folders for vault folder creation
        created_date_folders = []

        for filename in mp4_files:
            file_path = os.path.join(source_folder, filename)
            logger.debug(f"Processing file: {filename}")

            try:
                # Get file creation/modification date
                try:
                    # Get the file's modification time
                    file_mtime = os.path.getmtime(file_path)
                    file_date = datetime.fromtimestamp(file_mtime)
                    date_folder = file_date.strftime("%Y-%m-%d")
                    logger.debug(f"File date: {date_folder}")
                except Exception as e:
                    logger.error(f"Error getting file date, using current date: {e}")
                    date_folder = datetime.now().strftime("%Y-%m-%d")

                try:
                    logger.debug(f"Getting video length for: {filename}")
                    video_length = self.get_video_length(file_path)
                    logger.debug(f"Video length: {video_length} seconds")
                except Exception as e:
                    logger.error(f"Error getting video length, assuming valid length: {e}")
                    # Just assume it's a valid length if we can't determine it
                    video_length = delete_length_seconds + 1

                # Determine target folder
                if "backtrack" in filename.lower():
                    target_folder = os.path.join(backtrack_folder, date_folder)
                    logger.debug("File identified as backtrack")
                elif "replay" in filename.lower():
                    target_folder = os.path.join(replay_folder, date_folder)
                    logger.debug("File identified as replay")
                else:
                    target_folder = os.path.join(recording_folder, date_folder)
                    logger.debug("File identified as regular recording")

                logger.debug(f"Target folder: {target_folder}")
                os.makedirs(target_folder, exist_ok=True)
                
                # Track created folders for vault creation
                if target_folder not in created_date_folders:
                    created_date_folders.append(target_folder)

                # Handle auto-delete
                if auto_delete and video_length <= delete_length_seconds:
                    if "backtrack" not in filename.lower() and "replay" not in filename.lower():
                        logger.info(f"Deleting short file: {filename} ({video_length} seconds)")
                        os.remove(file_path)
                        files_skipped += 1
                        continue

                # Generate new filename
                existing_files = os.listdir(target_folder)
                file_index = len(existing_files) + 1
                new_filename = f"{file_index:03}.mp4"
                target_path = os.path.join(target_folder, new_filename)
                logger.debug(f"Moving file to: {target_path}")

                shutil.move(file_path, target_path)
                logger.info(f"Successfully moved {filename} to {new_filename}")
                files_processed += 1

            except Exception as e:
                logger.error(f"Error processing file {filename}: {e}", exc_info=True)
                files_skipped += 1
                print(f"Error processing file {filename}: {e}")
        
        # Create The Vault folders in all date folders that were created
        logger.info("Creating Vault folders in all processed date folders")
        for date_folder in created_date_folders:
            self.create_vault_folders(date_folder)
            # Sync any existing files in vault folders
            self.sync_vault_files(date_folder)

        logger.info(f"Sorting process completed. Processed: {files_processed}, Skipped/Deleted: {files_skipped}")
        self.status_label.config(text=f"Complete: {files_processed} files sorted, {files_skipped} skipped/deleted")
        self.save_configurations()
        # messagebox.showinfo("Complete", f"Sorting process completed! {files_processed} files sorted.")

    def get_video_length(self, file_path):
        """Get the length of a video file in seconds using FFprobe."""
        try:
            logger.debug(f"Running FFprobe on: {file_path}")
            
            # First, check if ffprobe is available
            try:
                subprocess.run(
                    ["ffprobe", "-version"],
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True,
                    timeout=1
                )
            except (subprocess.SubprocessError, FileNotFoundError):
                logger.error("FFprobe not available")
                # Return a value that won't trigger auto-delete
                return 999999
                
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                timeout=10  # Add timeout to prevent hanging
            )
            if result.returncode != 0:
                logger.error(f"FFprobe error: {result.stderr}")
                # Return a value that won't trigger auto-delete
                return 999999
                
            duration = float(result.stdout.strip())
            logger.debug(f"FFprobe returned duration: {duration} seconds")
            return duration
        except Exception as e:
            logger.error(f"Error getting video length for {file_path}: {e}", exc_info=True)
            # Return a value that won't trigger auto-delete
            return 999999

    def on_closing(self):
        """Handle window closing event"""
        logger.info("Application closing...")
        self.root.quit()

    def delayed_sort(self):
        """Run the sorter with a 5-second delay."""
        logger.info("Hotkey pressed! Starting delayed sort...")
        print("F9 or F14 pressed! Sorting will start in 5 seconds...")
        # Use after() to schedule the sort in the main thread
        self.root.after(5000, self.run_sorter)

    def listen_for_hotkeys(self):
        """Listen for F9 and F14 hotkeys and trigger the delayed_sort method."""
        logger.info("Starting hotkey listener...")
        try:
            # Add hotkeys with error handling
            try:
                keyboard.add_hotkey("f9", self.delayed_sort)
                logger.info("F9 hotkey registered successfully")
            except Exception as e:
                logger.error(f"Error registering F9 hotkey: {e}", exc_info=True)
                
            try:
                keyboard.add_hotkey("f14", self.delayed_sort)
                logger.info("F14 hotkey registered successfully")
            except Exception as e:
                logger.error(f"Error registering F14 hotkey: {e}", exc_info=True)

            # Keep the program running
            logger.info("Hotkey listener running. Press ESC to exit.")
            
            # Use a safer approach than wait() which can block
            while True:
                if keyboard.is_pressed("esc"):
                    logger.info("ESC pressed, exiting hotkey listener")
                    break
                time.sleep(0.1)  # Sleep to reduce CPU usage
                
        except Exception as e:
            logger.error(f"Error in hotkey listener: {e}", exc_info=True)

    def start_auto_delete_thread(self):
        if self.configurations["auto_delete"]:
            threading.Thread(target=self.auto_delete_files, daemon=True).start()

    def start_old_folder_delete_thread(self):
        if self.configurations["auto_delete_folders"]:
            threading.Thread(target=self.delete_old_folders, daemon=True).start()

    def auto_delete_files(self):
        while True:
            try:
                # Get delete length from configurations instead of UI element
                delete_length_minutes = self.configurations.get("delete_length_minutes", 5)
                delete_length_seconds = delete_length_minutes * 60  # Convert minutes to seconds
                
                source_folder = self.configurations.get("source_folder", "")
                if not source_folder or not os.path.exists(source_folder):
                    logger.warning(f"Source folder not found or not configured: {source_folder}")
                    time.sleep(60)
                    continue

                for filename in os.listdir(source_folder):
                    file_path = os.path.join(source_folder, filename)

                    # Process only .mp4 files
                    if os.path.isfile(file_path) and filename.lower().endswith('.mp4'):
                        try:
                            video_length = self.get_video_length(file_path)

                            if video_length <= delete_length_seconds:
                                if "backtrack" not in filename.lower() and "replay" not in filename.lower():
                                    os.remove(file_path)
                                    logger.info(f"Auto-delete: File {filename} deleted (length <= {delete_length_minutes} minutes).")
                        except Exception as e:
                            logger.error(f"Error in auto-delete process for file {filename}: {e}")

            except Exception as e:
                logger.error(f"Error in auto_delete_files: {e}", exc_info=True)
            
            time.sleep(60)  # Check every minute

    def delete_old_folders(self):
        """Periodically delete old folders based on the configuration."""
        while True:
            try:
                # Get the number of days from configurations
                delete_days = self.configurations.get('delete_length_days', 14)
                logger.info(f"Checking for folders older than {delete_days} days")

                folders = [
                    self.configurations.get("backtrack_folder", ""),
                    self.configurations.get("replay_folder", ""),
                    self.configurations.get("recording_folder", "")
                ]

                for folder in folders:
                    if not folder or not os.path.exists(folder):
                        logger.warning(f"Folder not found or not configured: {folder}")
                        continue

                    logger.debug(f"Checking for old folders in: {folder}")
                    for date_folder in os.listdir(folder):
                        date_folder_path = os.path.join(folder, date_folder)

                        if os.path.isdir(date_folder_path):
                            try:
                                # Try to parse the folder name as a date (YYYY-MM-DD format)
                                date_folder_date = datetime.strptime(date_folder, "%Y-%m-%d")
                                days_old = (datetime.now() - date_folder_date).days
                                
                                if days_old > delete_days:
                                    logger.info(f"Deleting folder {date_folder_path} (age: {days_old} days)")
                                    shutil.rmtree(date_folder_path)
                            except ValueError:
                                logger.warning(f"Folder {date_folder_path} does not match date format, skipping")
                            except Exception as e:
                                logger.error(f"Error deleting folder {date_folder_path}: {e}")

            except Exception as e:
                logger.error(f"Error in delete_old_folders: {e}", exc_info=True)

            # Check once per day
            logger.debug("Folder cleanup complete, waiting 24 hours before next check")
            time.sleep(86400)

    def create_settings_menu(self):
        """
        Create a settings menu with modern, app-consistent design.
        Overlays the main program at the same position and size.
        """
        # Create settings window
        settings_window = tk.Toplevel(self.root)
        settings_window.title("Settings")
        
        # Match main window geometry and position
        settings_window.geometry(self.root.geometry())
        settings_window.configure(bg=self.colors["background"])
        settings_window.overrideredirect(True)  # Removes default window decorations
        
        # Position the settings window exactly over the main window
        x = self.root.winfo_x()
        y = self.root.winfo_y()
        settings_window.geometry(f"+{x}+{y}")
    
        # Window movement variables
        self.settings_window_x = 0
        self.settings_window_y = 0
    
        # Custom title bar
        title_bar = tk.Frame(settings_window, bg=self.colors["surface"], height=30)
        title_bar.pack(fill=tk.X)
        title_bar.pack_propagate(False)
    
        # Minimize button
        minimize_btn = tk.Button(
            title_bar, 
            text="—", 
            bg=self.colors["surface"], 
            fg=self.colors["text_primary"],
            font=("Arial", 10, "bold"),
            borderwidth=0,
            command=lambda: settings_window.iconify()
        )
        minimize_btn.pack(side=tk.LEFT, padx=5)
    
        # App title
        title_label = tk.Label(
            title_bar, 
            text="Settings", 
            bg=self.colors["surface"], 
            fg=self.colors["text_primary"], 
            font=self.fonts["subtitle"]
        )
        title_label.pack(side=tk.LEFT, padx=10)
    
        # Close button
        close_btn = tk.Button(
            title_bar, 
            text="✕", 
            bg=self.colors["surface"], 
            fg=self.colors["accent"],
            font=("Arial", 10, "bold"),
            borderwidth=0,
            command=settings_window.destroy
        )
        close_btn.pack(side=tk.RIGHT, padx=5)
    
        # Window movement functions
        def start_move(event):
            """Start window movement tracking"""
            self.settings_window_x = event.x
            self.settings_window_y = event.y
    
        def stop_move(event):
            """Stop window movement tracking"""
            self.settings_window_x = None
            self.settings_window_y = None
    
        def do_move(event):
            """Move the window when dragging the title bar"""
            if self.settings_window_x is not None and self.settings_window_y is not None:
                x = settings_window.winfo_x() + (event.x - self.settings_window_x)
                y = settings_window.winfo_y() + (event.y - self.settings_window_y)
                settings_window.geometry(f"+{x}+{y}")
    
        # Bind movement events to title bar
        title_bar.bind("<ButtonPress-1>", start_move)
        title_bar.bind("<ButtonRelease-1>", stop_move)
        title_bar.bind("<B1-Motion>", do_move)
    
        # Main settings container
        settings_container = tk.Frame(settings_window, bg=self.colors["background"], padx=30, pady=30)
        settings_container.pack(expand=True, fill=tk.BOTH)
    
        # Auto Delete Files Section
        files_section_frame = tk.Frame(settings_container, bg=self.colors["background"])
        files_section_frame.pack(fill=tk.X, pady=10)
    
        # Section header
        files_header = tk.Label(
            files_section_frame, 
            text="Auto Delete Files", 
            font=self.fonts["header"], 
            fg=self.colors["text_primary"], 
            bg=self.colors["background"]
        )
        files_header.pack(anchor='w', pady=(0, 10))
    
        # Auto Delete Files Toggle
        files_toggle_frame = tk.Frame(files_section_frame, bg=self.colors["background"])
        files_toggle_frame.pack(fill=tk.X)
    
        files_toggle_label = tk.Label(
            files_toggle_frame, 
            text="Enable Auto Delete", 
            font=self.fonts["body"], 
            fg=self.colors["text_primary"], 
            bg=self.colors["background"]
        )
        files_toggle_label.pack(side=tk.LEFT)
    
        # Custom toggle switch for files
        self.files_toggle_switch = self.create_toggle_switch(
            files_toggle_frame, 
            initial_state=self.configurations.get('auto_delete', False)
        )
        self.files_toggle_switch.pack(side=tk.RIGHT)
    
        # Delete Length Entry for Files
        files_length_frame = tk.Frame(settings_container, bg=self.colors["background"])
        files_length_frame.pack(fill=tk.X, pady=10)
    
        files_length_label = tk.Label(
            files_length_frame, 
            text="Delete Files Shorter Than (minutes):", 
            font=self.fonts["body"], 
            fg=self.colors["text_primary"], 
            bg=self.colors["background"]
        )
        files_length_label.pack(side=tk.LEFT)
    
        self.files_length_entry = tk.Entry(
            files_length_frame, 
            width=5,
            font=self.fonts["mono"],
            bg=self.colors["surface"],
            fg=self.colors["text_primary"],
            insertbackground=self.colors["primary"],
            relief=tk.FLAT
        )
        self.files_length_entry.insert(0, str(self.configurations.get('delete_length_minutes', 5)))
        self.files_length_entry.pack(side=tk.RIGHT)
    
        # Auto Delete Folders Section
        folders_section_frame = tk.Frame(settings_container, bg=self.colors["background"])
        folders_section_frame.pack(fill=tk.X, pady=10)
    
        # Section header
        folders_header = tk.Label(
            folders_section_frame, 
            text="Auto Delete Folders", 
            font=self.fonts["header"], 
            fg=self.colors["text_primary"], 
            bg=self.colors["background"]
        )
        folders_header.pack(anchor='w', pady=(0, 10))
    
        # Auto Delete Folders Toggle
        folders_toggle_frame = tk.Frame(folders_section_frame, bg=self.colors["background"])
        folders_toggle_frame.pack(fill=tk.X)
    
        folders_toggle_label = tk.Label(
            folders_toggle_frame, 
            text="Enable Auto Delete", 
            font=self.fonts["body"], 
            fg=self.colors["text_primary"], 
            bg=self.colors["background"]
        )
        folders_toggle_label.pack(side=tk.LEFT)
    
        # Custom toggle switch for folders
        self.folders_toggle_switch = self.create_toggle_switch(
            folders_toggle_frame, 
            initial_state=self.configurations.get('auto_delete_folders', False)
        )
        self.folders_toggle_switch.pack(side=tk.RIGHT)
    
        # Delete Length Entry for Folders
        folders_length_frame = tk.Frame(settings_container, bg=self.colors["background"])
        folders_length_frame.pack(fill=tk.X, pady=10)
    
        folders_length_label = tk.Label(
            folders_length_frame, 
            text="Delete Folders Older Than (days):", 
            font=self.fonts["body"], 
            fg=self.colors["text_primary"], 
            bg=self.colors["background"]
        )
        folders_length_label.pack(side=tk.LEFT)
    
        self.folders_length_entry = tk.Entry(
            folders_length_frame, 
            width=5,
            font=self.fonts["mono"],
            bg=self.colors["surface"],
            fg=self.colors["text_primary"],
            insertbackground=self.colors["primary"],
            relief=tk.FLAT
        )
        self.folders_length_entry.insert(0, str(self.configurations.get('delete_length_days', 14)))
        self.folders_length_entry.pack(side=tk.RIGHT)
    
        # Save Button
        save_button = tk.Button(
            settings_container, 
            text="Save Settings", 
            command=lambda: self.save_settings(settings_window),
            font=self.fonts["header"],
            bg=self.colors["primary"], 
            fg=self.colors["background"], 
            activebackground=self.colors["secondary"],
            relief=tk.FLAT,
            padx=20,
            pady=10
        )
        save_button.pack(pady=20)
    
        # Restore window when it's minimized
        settings_window.bind("<Map>", lambda e: settings_window.deiconify())
    
        return settings_window

    def create_toggle_switch(self, parent, initial_state=False):
        """
        Create a custom toggle switch with app-consistent styling and color indicators.
        """
        # Toggle switch container
        toggle_container = tk.Frame(parent, bg=self.colors["background"])
    
        # Visual toggle switch
        toggle_switch = tk.Frame(
            toggle_container, 
            width=50, 
            height=20, 
            bg=self.colors["surface"]
        )
        toggle_switch.pack()
        toggle_switch.pack_propagate(False)
    
        # Toggle switch handle
        toggle_handle = tk.Frame(
            toggle_container, 
            width=20, 
            height=20, 
            bg=self.colors["text_secondary"]
        )
        
        # Initial state positioning and coloring
        initial_x = 30 if initial_state else 0
        toggle_handle.place(x=initial_x, y=0)
        
        # Background color based on initial state
        toggle_switch.configure(
            bg=self.colors["secondary"] if initial_state else self.colors["surface"]
        )
    
        # Toggle state tracking
        toggle_state = [initial_state]
    
        def toggle(event):
            """
            Toggle the switch state and animate the handle with color change.
            """
            toggle_state[0] = not toggle_state[0]
            new_x = 30 if toggle_state[0] else 0
            
            # Animate handle movement
            toggle_handle.place(x=new_x, y=0)
            
            # Change background color based on state
            toggle_switch.configure(
                bg=self.colors["secondary"] if toggle_state[0] else self.colors["surface"]
            )
    
        # Bind click events
        toggle_switch.bind("<Button-1>", toggle)
        toggle_handle.bind("<Button-1>", toggle)
    
        # Store state retrieval method
        toggle_container.get_state = lambda: toggle_state[0]
    
        return toggle_container

    def save_settings(self, settings_window=None):
        """
        Save the settings from the settings menu.
        """
        try:
            # Update auto delete file settings
            self.configurations['auto_delete'] = self.files_toggle_switch.get_state()
            
            # Validate and update delete length for files
            delete_length = int(self.files_length_entry.get())
            if delete_length > 0:
                self.configurations['delete_length_minutes'] = delete_length

            # Update auto delete folders settings
            self.configurations['auto_delete_folders'] = self.folders_toggle_switch.get_state()

            # Validate and update delete days for folders
            delete_days = int(self.folders_length_entry.get())
            if delete_days > 0:
                self.configurations['delete_length_days'] = delete_days

            # Save to config file
            self.save_configurations()

            # Restart auto-delete threads
            self.start_auto_delete_thread()
            self.start_old_folder_delete_thread()

            # Close settings window if provided
            if settings_window:
                settings_window.destroy()

            messagebox.showinfo("Settings", "Settings saved successfully!")
        except ValueError:
            messagebox.showerror("Error", "Invalid input. Please check your settings.")

    def start_vault_monitor_thread(self):
        """Start a thread to monitor vault folders for new files"""
        self.vault_monitor_thread = threading.Thread(target=self.monitor_vault_folders, daemon=True)
        self.vault_monitor_thread.start()
        logger.info("Started vault monitoring thread")
        
    def monitor_vault_folders(self):
        """Continuously monitor for new files in vault folders"""
        logger.info("Vault folder monitoring started")
        
        while True:
            try:
                # Get base folders
                backtrack_folder = self.configurations.get("backtrack_folder", "")
                replay_folder = self.configurations.get("replay_folder", "")
                recording_folder = self.configurations.get("recording_folder", "")
                vault_destination = self.configurations.get("vault_destination_folder", "")
                
                # Skip if any essential folder is not configured
                if not all([backtrack_folder, replay_folder, recording_folder, vault_destination]):
                    time.sleep(60)
                    continue
                    
                # Check if destination exists
                if not os.path.exists(vault_destination):
                    time.sleep(60)
                    continue
                
                # Scan all date folders in each base folder
                for base_folder in [backtrack_folder, replay_folder, recording_folder]:
                    if not os.path.exists(base_folder):
                        continue
                        
                    # Look for date folders
                    for date_folder_name in os.listdir(base_folder):
                        date_folder_path = os.path.join(base_folder, date_folder_name)
                        
                        # Skip if not a directory or not a date folder
                        if not os.path.isdir(date_folder_path):
                            continue
                            
                        # Check for vault folder
                        vault_folder = os.path.join(date_folder_path, "The Vault")
                        if os.path.exists(vault_folder):
                            # Sync any files in the vault folder
                            self.sync_vault_files(date_folder_path)
                
                # Sleep to avoid high CPU usage
                time.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error(f"Error in vault monitoring: {e}", exc_info=True)
                time.sleep(60)  # Wait before retrying


if __name__ == "__main__":
    root = tk.Tk()
    app = OBSAutoSorterApp(root)
    root.mainloop()