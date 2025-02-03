import os
import shutil
import tkinter as tk
from tkinter import filedialog, messagebox, PhotoImage
import json
import subprocess
from datetime import datetime
import platform
import threading
import time
import keyboard  # New library for hotkey detection
import sys

CONFIG_FILE = "obs_auto_sorter_config.json"


class OBSAutoSorterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("OBS Auto Sorter")

        # Set the window icon only for Windows
        if sys.platform == "win32":  # Check if running on Windows
            icon_path = os.path.join(os.path.dirname(__file__), "icon.ico")
            if os.path.exists(icon_path):
                self.root.iconbitmap(icon_path)
            else:
                print("Warning: icon.ico not found, skipping icon setup.")

        self.configurations = {
            "source_folder": "",
            "backtrack_folder": "",
            "replay_folder": "",
            "recording_folder": "",
            "auto_delete": False,
            "delete_length_minutes": 5  # Default to 5 minutes
        }

        # Load configurations from JSON
        self.load_configurations()

        # GUI Elements
        tk.Label(root, text="Source Folder:").grid(row=0, column=0, padx=10, pady=5)
        self.source_folder_entry = tk.Entry(root, width=40)
        self.source_folder_entry.grid(row=0, column=1, padx=10, pady=5)
        tk.Button(root, text="Browse", command=self.browse_source_folder).grid(row=0, column=2, padx=10, pady=5)

        tk.Label(root, text="Backtrack Folder:").grid(row=1, column=0, padx=10, pady=5)
        self.backtrack_folder_entry = tk.Entry(root, width=40)
        self.backtrack_folder_entry.grid(row=1, column=1, padx=10, pady=5)
        tk.Button(root, text="Browse", command=self.browse_backtrack_folder).grid(row=1, column=2, padx=10, pady=5)

        tk.Label(root, text="Replay Folder:").grid(row=2, column=0, padx=10, pady=5)
        self.replay_folder_entry = tk.Entry(root, width=40)
        self.replay_folder_entry.grid(row=2, column=1, padx=10, pady=5)
        tk.Button(root, text="Browse", command=self.browse_replay_folder).grid(row=2, column=2, padx=10, pady=5)

        tk.Label(root, text="Recording Folder:").grid(row=3, column=0, padx=10, pady=5)
        self.recording_folder_entry = tk.Entry(root, width=40)
        self.recording_folder_entry.grid(row=3, column=1, padx=10, pady=5)
        tk.Button(root, text="Browse", command=self.browse_recording_folder).grid(row=3, column=2, padx=10, pady=5)

        self.auto_delete_var = tk.BooleanVar(value=self.configurations["auto_delete"])
        tk.Checkbutton(root, text="Enable Auto-Delete", variable=self.auto_delete_var).grid(row=4, column=1, padx=10, pady=5)

        tk.Label(root, text="Auto-Delete Length (minutes):").grid(row=5, column=0, padx=10, pady=5)
        self.auto_delete_length_entry = tk.Entry(root, width=10)
        self.auto_delete_length_entry.grid(row=5, column=1, padx=10, pady=5)
        self.auto_delete_length_entry.insert(0, str(self.configurations.get("delete_length_minutes", 5)))

        tk.Button(root, text="Sort Clips", command=self.run_sorter).grid(row=6, column=1, pady=10)

        # Pre-fill the folder entries
        self.source_folder_entry.insert(0, self.configurations["source_folder"])
        self.backtrack_folder_entry.insert(0, self.configurations["backtrack_folder"])
        self.replay_folder_entry.insert(0, self.configurations["replay_folder"])
        self.recording_folder_entry.insert(0, self.configurations["recording_folder"])

        # Start the hotkey listener in a separate thread
        threading.Thread(target=self.listen_for_hotkeys, daemon=True).start()

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