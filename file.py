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
            "auto_delete": False,
            "delete_length_minutes": 5
        }

        # Load configurations from JSON
        self.load_configurations()

        # Create UI Components
        self.create_header()
        self.create_folder_sections()
        self.create_auto_delete_section()
        self.create_action_buttons()

        # Add hover and click effects
        self.add_hover_effects()

        # Start the hotkey listener in a separate thread
        threading.Thread(target=self.listen_for_hotkeys, daemon=True).start()

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
            ("Recording Folder", self.browse_recording_folder, "recording_folder")
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

    def create_auto_delete_section(self):
        # Auto-delete section with modern toggle switch
        auto_delete_frame = tk.Frame(self.main_frame, bg=self.colors["background"])
        auto_delete_frame.pack(fill=tk.X, pady=10)

        # Custom toggle switch
        self.auto_delete_var = tk.BooleanVar(value=self.configurations["auto_delete"])
        
        # Toggle switch container
        toggle_container = tk.Frame(auto_delete_frame, bg=self.colors["background"])
        toggle_container.pack(side=tk.LEFT, padx=(0, 20))

        # Visual toggle switch
        self.toggle_switch = tk.Frame(
            toggle_container, 
            width=50, 
            height=20, 
            bg=self.colors["surface"]
        )
        self.toggle_switch.pack(side=tk.LEFT)
        self.toggle_switch.pack_propagate(False)
        self.toggle_switch.grid_propagate(False)

        # Toggle switch handle
        self.toggle_handle = tk.Frame(
            self.toggle_switch, 
            width=20, 
            height=20, 
            bg=self.colors["text_secondary"]
        )
        self.toggle_handle.place(x=0, y=0)

        # Delete length label and entry
        delete_label = tk.Label(
            auto_delete_frame, 
            text="Auto-Delete Length:", 
            font=self.fonts["body"], 
            fg=self.colors["text_primary"], 
            bg=self.colors["background"]
        )
        delete_label.pack(side=tk.LEFT, padx=(0, 10))

        self.auto_delete_length_entry = tk.Entry(
            auto_delete_frame, 
            width=10, 
            font=self.fonts["mono"],
            bg=self.colors["surface"],  # Always keep dark background
            fg=self.colors["text_primary"], 
            insertbackground=self.colors["primary"],
            relief=tk.FLAT,
            highlightthickness=1,
            highlightcolor=self.colors["secondary"],
            highlightbackground=self.colors["surface"],
            disabledbackground=self.colors["surface"],
            disabledforeground=self.colors["text_secondary"]
        )
        self.auto_delete_length_entry.pack(side=tk.LEFT)

        # Function to validate and save auto-delete length
        def validate_and_save_length(event=None):
            try:
                length = int(self.auto_delete_length_entry.get())
                if 1 <= length <= 1440:
                    self.configurations["delete_length_minutes"] = length
                    self.save_configurations()
                else:
                    # Reset to previous value if invalid
                    self.auto_delete_length_entry.delete(0, tk.END)
                    self.auto_delete_length_entry.insert(0, str(self.configurations.get("delete_length_minutes", 5)))
            except ValueError:
                # Reset to previous value if not a valid integer
                self.auto_delete_length_entry.delete(0, tk.END)
                self.auto_delete_length_entry.insert(0, str(self.configurations.get("delete_length_minutes", 5)))
            
            # Remove focus and stop cursor blinking
            self.auto_delete_length_entry.config(
                insertbackground=self.colors["background"]
            )
            self.main_frame.focus()

        # Bind focus out event
        self.auto_delete_length_entry.bind("<FocusOut>", validate_and_save_length)

        # Toggle function
        def toggle_auto_delete(event=None):
            # Toggle the state
            current_state = self.auto_delete_var.get()
            new_state = not current_state
            self.auto_delete_var.set(new_state)
            
            # Update configuration
            self.configurations["auto_delete"] = new_state
            self.save_configurations()

            if new_state:
                # Enabled state
                self.toggle_handle.place(x=30, y=0)
                self.toggle_switch.config(bg=self.colors["success"])
                self.toggle_handle.config(bg=self.colors["text_primary"])
                self.auto_delete_length_entry.config(state='normal')
            else:
                # Disabled state
                self.toggle_handle.place(x=0, y=0)
                self.toggle_switch.config(bg=self.colors["surface"])
                self.toggle_handle.config(bg=self.colors["text_secondary"])
                self.auto_delete_length_entry.config(state='disabled')
                
                # Reset entry to original value
                self.auto_delete_length_entry.delete(0, tk.END)
                self.auto_delete_length_entry.insert(0, str(self.configurations.get("delete_length_minutes", 5)))

        # Bind click events to toggle switch
        self.toggle_switch.bind("<Button-1>", toggle_auto_delete)
        self.toggle_handle.bind("<Button-1>", toggle_auto_delete)
        
        # Set initial state
        if self.configurations["auto_delete"]:
            self.toggle_handle.place(x=30, y=0)
            self.toggle_switch.config(bg=self.colors["success"])
            self.toggle_handle.config(bg=self.colors["text_primary"])
        else:
            self.auto_delete_length_entry.config(state='disabled')
        
        # Pre-fill the entry
        self.auto_delete_length_entry.insert(0, str(self.configurations.get("delete_length_minutes", 5)))

    def create_action_buttons(self):
        # Action buttons section with advanced styling
        action_frame = tk.Frame(self.main_frame, bg=self.colors["background"])
        action_frame.pack(fill=tk.X, pady=(20, 0))

        # Gradient-like sort button
        sort_button = tk.Button(
            action_frame, 
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
        sort_button.pack(expand=True)

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

    def save_configurations(self):
        """Save configurations to a JSON file."""
        self.configurations["auto_delete"] = self.auto_delete_var.get()
        self.configurations["delete_length_minutes"] = int(self.auto_delete_length_entry.get())
        with open(CONFIG_FILE, "w") as config_file:
            json.dump(self.configurations, config_file, indent=4)

    def load_configurations(self):
        """Load configurations from a JSON file."""
        default_configurations = {
            "source_folder": "",
            "backtrack_folder": "",
            "replay_folder": "",
            "recording_folder": "",
            "auto_delete": False,
            "delete_length_minutes": 5  # Default to 5 minutes
        }

        if os.path.exists(CONFIG_FILE):
            try:
                with open(CONFIG_FILE, "r") as config_file:
                    loaded_config = json.load(config_file)
                    self.configurations.update({**default_configurations, **loaded_config})
            except json.JSONDecodeError:
                print("Error reading configuration file. Using default settings.")
                self.configurations = default_configurations
        else:
            self.configurations = default_configurations

    def run_sorter(self):
        source_folder = self.source_folder_entry.get()
        backtrack_folder = self.backtrack_folder_entry.get()
        replay_folder = self.replay_folder_entry.get()
        recording_folder = self.recording_folder_entry.get()
        auto_delete = self.auto_delete_var.get()

        try:
            delete_length_minutes = int(self.auto_delete_length_entry.get())
            delete_length_seconds = delete_length_minutes * 60  # Convert minutes to seconds
        except ValueError:
            messagebox.showerror("Error", "Please enter a valid number for auto-delete length in minutes.")
            return

        if not all([source_folder, backtrack_folder, replay_folder, recording_folder]):
            messagebox.showerror("Error", "Please select all required folders.")
            return

        date_folder = datetime.now().strftime("%Y-%m-%d")  # Current date as folder name

        for filename in os.listdir(source_folder):
            file_path = os.path.join(source_folder, filename)

            # Process only .mkv files
            if os.path.isfile(file_path) and filename.lower().endswith('.mkv'):
                try:
                    video_length = self.get_video_length(file_path)

                    # Determine target folder and create date folder
                    if "backtrack" in filename.lower():
                        target_folder = os.path.join(backtrack_folder, date_folder)
                    elif "replay" in filename.lower():
                        target_folder = os.path.join(replay_folder, date_folder)
                    else:
                        target_folder = os.path.join(recording_folder, date_folder)

                    os.makedirs(target_folder, exist_ok=True)

                    # Handle auto-delete condition, ignoring "backtrack" and "replay"
                    if auto_delete and video_length <= delete_length_seconds:
                        if "backtrack" not in filename.lower() and "replay" not in filename.lower():
                            os.remove(file_path)
                            print(f"File {filename} deleted (length <= {delete_length_minutes} minutes).")
                            continue

                    # Generate sequential filename
                    existing_files = os.listdir(target_folder)
                    file_index = len(existing_files) + 1
                    new_filename = f"{file_index:03}.mkv"
                    target_path = os.path.join(target_folder, new_filename)

                    shutil.move(file_path, target_path)
                    print(f"File {filename} renamed to {new_filename} and moved to {target_folder}.")
                except Exception as e:
                    print(f"Error processing file {filename}: {e}")

        # Save configurations after sorting
        self.save_configurations()

    def get_video_length(self, file_path):
        """Get the length of a video file in seconds using FFprobe."""
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            return float(result.stdout.strip())
        except Exception as e:
            print(f"Error retrieving video length for {file_path}: {e}")
            return 0

    def delayed_sort(self):
        """Run the sorter with a 5-second delay."""
        print("F9 or F14 pressed! Sorting will start in 5 seconds...")
        time.sleep(5)
        self.run_sorter()

    def listen_for_hotkeys(self):
        """Listen for F9 and F14 hotkeys and trigger the delayed_sort method."""
        # Add hotkeys
        keyboard.add_hotkey("f9", self.delayed_sort)
        keyboard.add_hotkey("f14", self.delayed_sort)

        # Keep the program running
        print("Listening for F9 and F14 hotkeys. Press ESC to exit.")
        keyboard.wait("esc")


if __name__ == "__main__":
    root = tk.Tk()
    app = OBSAutoSorterApp(root)
    root.mainloop()