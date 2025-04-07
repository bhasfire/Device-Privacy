#!/usr/bin/env python3
import os
import json
import subprocess
import hashlib
import logging

MAC_PERMISSION_MAPPING = {
    # High-risk permissions
    "NSCameraUsageDescription": {"score": 25, "description": "Access to camera"},
    "NSMicrophoneUsageDescription": {"score": 25, "description": "Access to microphone"},
    "NSLocationAlwaysUsageDescription": {"score": 25, "description": "Access to location at all times"},
    "NSLocationWhenInUseUsageDescription": {"score": 25, "description": "Access to location when app is in use"},
    "NSContactsUsageDescription": {"score": 25, "description": "Access to contacts"},
    "NSCalendarsUsageDescription": {"score": 25, "description": "Access to calendars"},
    "NSRemindersUsageDescription": {"score": 25, "description": "Access to reminders"},
    "NSHomeKitUsageDescription": {"score": 25, "description": "Access to HomeKit accessories"},
    # Medium-risk permissions
    "NSPhotoLibraryUsageDescription": {"score": 20, "description": "Access to photo library"},
    "NSBluetoothAlwaysUsageDescription": {"score": 20, "description": "Access to Bluetooth"},
    "NSMotionUsageDescription": {"score": 15, "description": "Access to motion & fitness data"},
    "NSSpeechRecognitionUsageDescription": {"score": 20, "description": "Access to speech recognition"},
    "NSFaceIDUsageDescription": {"score": 20, "description": "Access to Face ID"},
    # Lower-risk permissions
    "NSUserTrackingUsageDescription": {"score": 10, "description": "App tracking capabilities"},
    "NSLocalNetworkUsageDescription": {"score": 10, "description": "Access to local network"},
    "NSSiriUsageDescription": {"score": 10, "description": "Access to Siri"},
    "NSDesktopFolderUsageDescription": {"score": 10, "description": "Access to Desktop folder"},
    "NSDocumentsFolderUsageDescription": {"score": 10, "description": "Access to Documents folder"},
    "NSDownloadsFolderUsageDescription": {"score": 10, "description": "Access to Downloads folder"}
}

def generate_cache_key(app_path):
    return hashlib.md5(app_path.encode()).hexdigest()

def get_info_plist(plist_path):
    try:
        result = subprocess.run(['plutil', '-convert', 'json', '-o', '-', plist_path],
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        return json.loads(result.stdout)
    except Exception as e:
        logging.error(f"Error reading Info.plist at {plist_path}: {e}")
        return None

def get_mac_app_permissions(app_path):
    if not app_path.endswith('.app'):
        return {"error": "Not a Mac application bundle (.app)"}
    if not os.path.exists(app_path):
        return {"error": "Application path does not exist"}
    info_plist_path = os.path.join(app_path, "Contents", "Info.plist")
    info_plist = get_info_plist(info_plist_path)
    if not info_plist:
        return {"error": "Could not read Info.plist file"}
    permissions_found = []
    for key, mapping in MAC_PERMISSION_MAPPING.items():
        if key in info_plist:
            permissions_found.append({
                "id": key,
                "name": key.replace("NS", "").replace("UsageDescription", ""),
                "description": mapping["description"],
                "score": mapping["score"]
            })
    total_score = sum(perm["score"] for perm in permissions_found)
    total_score = min(total_score, 100)  # Cap at 100
    return {
        "appInfo": {
            "bundleId": info_plist.get("CFBundleIdentifier", "Unknown"),
            "version": info_plist.get("CFBundleShortVersionString") or info_plist.get("CFBundleVersion") or "Unknown",
            "name": info_plist.get("CFBundleDisplayName") or info_plist.get("CFBundleName") or os.path.basename(app_path).replace('.app','')
        },
        "permissions": permissions_found,
        "totalScore": total_score,
        "permissionCount": len(permissions_found)
    }

def mac_get_permission_score(app_path):
    try:
        if not os.path.exists(app_path):
            return {
                "score": 0,
                "permissions": ["Unknown (Path not found)"],
                "details": [{"description": "Path not found", "score": 0}]
            }
        if not app_path.endswith('.app'):
            return {
                "score": 0,
                "permissions": ["Unknown (Not a Mac application)"],
                "details": [{"description": "Not a Mac application bundle (.app)", "score": 0}]
            }
        result = get_mac_app_permissions(app_path)
        if "error" in result:
            return {
                "score": 10,
                "permissions": [f"Error: {result['error']}"],
                "details": [{"description": result["error"], "score": 10}]
            }
        permission_list = [perm["description"] for perm in result["permissions"]]
        details_list = [{"description": perm["description"], "score": perm["score"]} for perm in result["permissions"]]
        total_score = result["totalScore"]
        return {
            "score": total_score,
            "permissions": permission_list,
            "details": details_list,
            "appInfo": result["appInfo"]
        }
    except Exception as e:
        return {
            "score": 20,
            "permissions": ["Error analyzing application"],
            "details": [{"description": "Error analyzing application: " + str(e), "score": 20}]
        }

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1:
        app_path = sys.argv[1]
        result = mac_get_permission_score(app_path)
        print(json.dumps(result, indent=2))
    else:
        print("Usage: scanner.py <app_path>")
