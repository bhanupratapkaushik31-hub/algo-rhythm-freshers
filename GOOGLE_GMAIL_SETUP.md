# Google Gmail API OAuth2 Setup Guide

To securely send tickets from **scailpu@gmail.com** without storing or using standard account passwords or app passwords (which Google can block or deprecate), follow these steps to obtain Google Cloud OAuth2 Client credentials and a persistent refresh token.

## Step 1: Create a Google Cloud Project
1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Log in with the official event account **scailpu@gmail.com**.
3. Click on the project selection dropdown in the top-left and select **New Project**.
4. Name the project `ALGO-RHYTHM 2K26` and click **Create**.

## Step 2: Enable the Gmail API
1. In the sidebar, select **APIs & Services** > **Library**.
2. Search for `Gmail API` and click on it.
3. Click **Enable** to enable it for your project.

## Step 3: Configure the OAuth Consent Screen
1. Go to **APIs & Services** > **OAuth consent screen** in the sidebar.
2. Select **External** as the User Type and click **Create**.
3. Fill in the required fields:
   - **App name**: `ALGO-RHYTHM Ticketing Service`
   - **User support email**: `scailpu@gmail.com`
   - **Developer contact email**: `scailpu@gmail.com`
4. Click **Save and Continue** through the scopes panel (the default scopes are sufficient).
5. Under **Test Users**, click **Add Users** and add `scailpu@gmail.com`. (Since the app is in testing mode, only explicitly declared test users can authenticate to obtain credentials).
6. Click **Save and Continue** and return to the dashboard.

## Step 4: Create OAuth Client Credentials
1. Go to **APIs & Services** > **Credentials** in the sidebar.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. Under **Application type**, select **Web application**.
4. Name it `ALGO-RHYTHM Tickets Web App`.
5. Under **Authorized redirect URIs**, click **+ Add URI** and add:
   - For local development testing: `https://developers.google.com/oauthplayground` (used to generate the refresh token easily)
6. Click **Create**.
7. Copy the generated **Client ID** and **Client Secret** (you will save these in your environment configurations).

## Step 5: Generate the OAuth2 Refresh Token
The easiest way to obtain a persistent refresh token is using Google's official OAuth Playground:
1. Open the [Google OAuth2 Playground](https://developers.google.com/oauthplayground/).
2. Click on the gear icon (settings) in the top-right corner.
3. Check the box **Use own OAuth credentials**.
4. Enter the **OAuth Client ID** and **OAuth Client Secret** you copied in Step 4.
5. In the left panel (Step 1 of the playground), find **Gmail API v1** and expand it.
6. Select the scope `https://mail.google.com/` (full access scope for SMTP OAuth dispatch).
7. Click the blue **Authorize APIs** button. You will be redirected to Google's login screen.
8. Log in with `scailpu@gmail.com`. Click **Continue / Allow** if prompted with warning pages.
9. After redirecting back to the playground, click the **Exchange authorization code for tokens** button in Step 2.
10. Copy the generated **Refresh Token** from the JSON payload or the left-hand input.

## Step 6: Configure Environment Variables
Save the keys in `.env.local` for local development, and in your **Vercel Project Dashboard** under Environment Variables:

```env
GOOGLE_CLIENT_ID=your_copied_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_copied_google_client_secret
GOOGLE_REFRESH_TOKEN=your_copied_oauth_refresh_token
GMAIL_USER=scailpu@gmail.com
```

Once configured, the server-side email dispatch service will automatically authorize and send emails directly from `scailpu@gmail.com` using the Google APIs.
