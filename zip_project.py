import zipfile
import os

project_dir = r"/Users/rishvinreddy/Desktop/Rishvin/Books /Projects /2 Smart waste statations /complete project"
zip_path = r"/Users/rishvinreddy/Desktop/Rishvin/Books /Projects /2 Smart waste statations /rishvin_reddy_project.zip"
exclude_dirs = {'.venv', 'node_modules', '__pycache__', '.git', '.next', 'build', 'dist'}
exclude_files = {'waste_management.db', 'rishvin_reddy_project.zip'}

print(f"Creating zip file at {zip_path}...")
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(project_dir):
        # Modify dirs in-place to skip excluded directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file not in exclude_files and not file.endswith('.zip'):
                file_path = os.path.join(root, file)
                # Add file to zip with relative path
                zipf.write(file_path, os.path.relpath(file_path, os.path.dirname(project_dir)))
                
print("Done! Zip file created successfully.")
