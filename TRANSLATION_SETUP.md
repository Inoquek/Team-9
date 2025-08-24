# 🌐 Translation Setup Guide

## **Setup Steps:**

### 1. **Create Environment File**
Create a `.env` file in your project root:
```env
VITE_GOOGLE_TRANSLATE_API_KEY=your_api_key_here
```

### 2. **Get Your API Key**
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create a new project or select existing one
- Enable "Cloud Translation API"
- Create API credentials
- Copy your API key

### 3. **Add to .gitignore**
Make sure `.env` is in your `.gitignore`:
```gitignore
.env
.env.local
```

## **How It Works:**

1. **Click the language button** in the top-right corner
2. **Select Chinese** to translate the entire page
3. **All text gets translated** automatically including:
   - UI elements
   - Forum posts and comments
   - Assignment content
   - Any new content that loads

## **Features:**

- ✅ **Simple one-click translation**
- ✅ **Automatic content detection**
- ✅ **Real-time translation** for new content
- ✅ **Smart caching** to avoid repeated API calls
- ✅ **Professional quality** translations

## **Cost:**

- **Free Tier**: 500,000 characters/month
- **Paid**: $20 per 1 million characters
- **Typical Usage**: Under $5-10/month

## **Troubleshooting:**

- **Check API key** is correct in `.env` file
- **Verify billing** is enabled in Google Cloud
- **Check console** for any error messages
- **Ensure API** is enabled in Google Cloud Console
