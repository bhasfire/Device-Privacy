//
//  AppDelegate.swift
//  devicePrivacyMacDaemon
//
//  Created by Siddharth Iyer on 3/29/25.
//

import Cocoa

@NSApplicationMain
class AppDelegate: NSObject, NSApplicationDelegate {

    func applicationDidFinishLaunching(_ aNotification: Notification) {
        // To be handled for debugging
        print("DevicePrivacy Daemon launched without URL trigger.")
    }
    
    func application(_ application: NSApplication, open urls: [URL]) {
        guard let url = urls.first,
              url.scheme == "deviceprivacy",
              url.host == "start" else {
            return
        }
        print("Received URL: \(url.absoluteString)")
        startDaemon()
    }
    
    func startDaemon() {
        print("Daemon started. Beginning scan...")
        
        DispatchQueue.global().async {
            sleep(5)
            print("Scan complete. Shutting down daemon.")
            DispatchQueue.main.async {
                NSApp.terminate(self)
            }
        }
    }
}
