#!/usr/bin/env python3
import os
import subprocess
import json
import logging

LOG_FILE_PATH = "installed_apps_log.txt"

def write_log_file(apps):
    log_content = "Installed Apps Log\n===================\n"
    log_content += f"Total Apps Found: {len(apps)}\n\n"
    for idx, app in enumerate(apps, start=1):
        log_content += f"{idx}. {app['name']}\n   Path: {app['path']}\n   Version: {app.get('version', 'Unknown')}\n   BundleId: {app.get('bundleId', 'Unknown')}\n\n"
    with open(LOG_FILE_PATH, "w", encoding="utf-8") as f:
        f.write(log_content)
    logging.info(f"Log written to {LOG_FILE_PATH}")

def get_installed_apps():
    application_directories = [
        "/Applications",
        "/System/Applications",
        os.path.join(os.environ.get("HOME", ""), "Applications")
    ]
    all_apps = []
    for app_dir in application_directories:
        if os.path.exists(app_dir):
            try:
                # Use 'find' command to list .app bundles (maxdepth 1)
                result = subprocess.run(['find', app_dir, '-maxdepth', '1', '-name', '*.app'], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                app_paths = result.stdout.splitlines()
                for app_path in app_paths:
                    if not app_path.strip():
                        continue
                    app_name = os.path.basename(app_path).replace('.app', '')
                    version = "Unknown"
                    bundleId = "Unknown"
                    info_plist_path = os.path.join(app_path, "Contents", "Info.plist")
                    if os.path.exists(info_plist_path):
                        try:
                            plist_result = subprocess.run(['plutil', '-convert', 'json', '-o', '-', info_plist_path], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                            plist_data = json.loads(plist_result.stdout)
                            version = plist_data.get("CFBundleShortVersionString") or plist_data.get("CFBundleVersion") or "Unknown"
                            bundleId = plist_data.get("CFBundleIdentifier") or "Unknown"
                        except Exception as e:
                            logging.error(f"Error reading plist for {app_path}: {e}")
                    all_apps.append({
                        "name": app_name,
                        "path": app_path,
                        "version": version,
                        "bundleId": bundleId
                    })
            except Exception as e:
                logging.error(f"Error scanning directory {app_dir}: {e}")
        else:
            logging.info(f"Directory {app_dir} does not exist")
    write_log_file(all_apps)
    return all_apps

if __name__ == '__main__':
    apps = get_installed_apps()
    print(json.dumps({"installedApps": apps}, indent=2))
