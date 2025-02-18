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

AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1

2. Start the backend server

```node server.js```