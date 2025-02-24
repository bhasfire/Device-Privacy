# Device Privacy Web App

This project provides a web interface for analyzing the privacy scores of applications installed on a user's system. It uses the File System Access API to read application names and retrieves privacy scores from a DynamoDB database.

---

## Features
- Allows users to select directories and list installed applications.
- Fetches privacy scores from a backend API connected to DynamoDB.
- Runs as a web application using Node.js and Express.

---

## Prerequisites

Ensure you have the following installed:

- **Node.js** (v16 or later)
- **npm** (comes with Node.js)
- **AWS DynamoDB Table** (if connecting to AWS)

---

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd device-privacy-webapp
   ```

2. Install Required depedencies:

    ```npm install```

## Running the Web Application 

Start the Backend Server

1. Set up AWS credentials by creating a .env file in the project root
    ```bash
    AWS_ACCESS_KEY_ID=your-access-key
    AWS_SECRET_ACCESS_KEY=your-secret-key
    AWS_REGION=us-east-2
    ```

2. Start the backend server

```node server.js```

3. Start the frontend

```npx serve -l 3001``` 

## Privacy Risk Scoring Algorithm

The **DevicePrivacy** feature evaluates the privacy risk of installed applications by analyzing key risk factors and generating a **privacy risk score** for each app. This score helps users understand how an application may impact their privacy.

### How It Works

1. **Directory Selection**: Users select a folder containing installed applications.
2. **Metadata Extraction**: The system retrieves application details without accessing sensitive data.
3. **Risk Factor Analysis**: Each application is evaluated based on:
   - **Permissions Used**: Access to system resources (e.g., location, contacts, microphone).
   - **Network Activity**: Internet connections and data transmission behavior.
   - **Data Collection**: Personal information accessed or shared by the app.
   - **Process Behavior**: Background activity and system modifications.
   - **Known Threats**: Matches against security databases for flagged applications.
4. **Score Calculation**: Each factor is weighted, and an overall **privacy risk score (0-100)** is assigned.
   - 🟢 **Low Risk (0-30)**: Minimal privacy concerns.
   - 🟡 **Medium Risk (31-60)**: May require user review.
   - 🔴 **High Risk (61-100)**: Potential privacy threat.

### Why It Matters

This scoring system provides **transparent and actionable insights**, allowing users to **identify, review, and manage** applications based on privacy impact. By proactively assessing privacy risks, users can make informed decisions about the apps installed on their devices.
