# DevicePrivacy

A privacy analysis tool that scans installed applications on Windows and evaluates their privacy risk based on permissions, DLL usage, and system access patterns.

## Features

- **Application Scanning**: Automatically detects installed applications on Windows systems
- **Permission Analysis**: Extracts and analyzes app permissions from manifest files and DLL imports
- **Privacy Risk Scoring**: Calculates privacy risk scores (0-100) based on requested permissions
- **User-Friendly Interface**: Visual dashboard showing risk levels and detailed permission information

## Prerequisites

- **Node.js** (v16 or later)
- **Windows OS** (application detection optimized for Windows)
- **Administrator Privileges** (required for comprehensive app scanning)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd device-privacy
   ```

2. Install dependencies:
   ```bash
   npm install express cors xml2js util crypto child_process path fs os pe-library
   ```

## Running the Application

1. Start the server with administrator privileges:
   ```bash
   # Windows - Run Command Prompt as Administrator, then:
   node server.js
   ```

2. Open the web application:
   - Navigate to `http://localhost:5001` in your browser

## How It Works

### Privacy Risk Scoring Algorithm

DevicePrivacy evaluates applications based on:

1. **Permissions Analysis**:
   - UWP Apps: Analyzes manifest files for declared capabilities
   - Desktop Apps: Examines imported DLLs to infer system access patterns
   - MSI Installers: Evaluates installation behaviors and system modifications

2. **Risk Categorization**:
   - 🟢 **Low Risk (0-30)**: Minimal privacy concerns
   - 🟡 **Medium Risk (31-60)**: Some privacy considerations
   - 🔴 **High Risk (61-100)**: Significant privacy impact

3. **Detailed Permission Reporting**:
   - Shows specific permissions with explanations
   - Identifies high-risk permissions (camera, location, contacts, etc.)
   - Detects network access capabilities

## Project Structure

```
DevicePrivacy/
│
├── server.js                   // Main server file
├── routes/
│   └── privacyRoutes.js        // API routes for privacy scanning
├── services/
│   ├── installedAppsScanner.js // Scans for installed applications
│   └── permissionScanner.js    // Analyzes app permissions
└── public/
    ├── index.html              // Web UI
    └── script.js               // Frontend functionality
```

## Current Limitations

- Windows-only support (macOS/Linux support planned)
- Some UWP apps may have restricted access to manifest files
- Requires administrator privileges for comprehensive scanning

## Future Enhancements

- Network traffic analysis
- Data collection detection
- Integration with threat intelligence databases
- Cross-platform support