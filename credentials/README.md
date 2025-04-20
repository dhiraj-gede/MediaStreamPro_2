# Google Drive Service Account Setup

This directory is where you should place your Google Drive service account credentials JSON files.

## How to create a Google Drive service account

1. **Create a Google Cloud Project**
   - Go to the [Google Cloud Console](https://console.cloud.google.com/)
   - Click "Select a project" at the top of the page
   - Click "New Project"
   - Enter a name for your project and click "Create"

2. **Enable the Google Drive API**
   - From your Google Cloud Project dashboard, navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click on the Google Drive API and click "Enable"

3. **Create a Service Account**
   - Navigate to "IAM & Admin" > "Service Accounts"
   - Click "Create Service Account"
   - Enter a name and description for your service account
   - Click "Create and Continue"
   - For the role, you can skip this step by clicking "Continue"
   - Click "Done"

4. **Generate a Key for the Service Account**
   - Click on the service account you just created
   - Go to the "Keys" tab
   - Click "Add Key" > "Create new key"
   - Select "JSON" and click "Create"
   - The JSON key file will be downloaded to your computer

5. **Place the Key in this Directory**
   - Move the downloaded JSON key file to this `/credentials` directory
   - Make note of the path (e.g., `/credentials/service-account-name.json`)

6. **Share Google Drive Folders with the Service Account**
   - The service account has an email address (found in the JSON file under `client_email`)
   - Share any Google Drive folders you want to access with this email address
   - Grant at least "Editor" permissions

7. **Add the Service Account to the Application**
   - Use the "Add Service Account" feature in the Storage Management page
   - Enter the service account details, including the path to the JSON key file

## Security Notes

- Keep your service account key files secure
- Don't commit these files to public repositories
- The service account will have access to any Google Drive folders shared with it
