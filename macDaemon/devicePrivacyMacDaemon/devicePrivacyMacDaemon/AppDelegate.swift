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
        
        guard let scannerBinaryURL = Bundle.main.url(forResource: "scanner", withExtension: nil) else {
            print("Scanner binary not found in bundle!")
            NSApp.terminate(self)
            return
        }
        
        let process = Process()
        process.executableURL = scannerBinaryURL
        process.arguments = []
        
        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe
        
        process.terminationHandler = { proc in
            let data = pipe.fileHandleForReading.readDataToEndOfFile()
            if let output = String(data: data, encoding: .utf8) {
                print("Scanner output:\n\(output)")
            }
            DispatchQueue.main.async {
                NSApp.terminate(self)
            }
        }
        
        do {
            try process.run()
        } catch {
            print("Error running scanner binary: \(error)")
            NSApp.terminate(self)
        }
    }
}
