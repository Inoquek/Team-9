# To run the project


clone the repo
cd team -9
npm install
nom run dev

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Mobile Responsiveness

This application is fully responsive and follows a **mobile-first** design approach. Key features include:

- 📱 **Mobile-first design** - Optimized for mobile devices first, then enhanced for larger screens
- 🎯 **Touch-friendly interfaces** - All interactive elements meet minimum touch target requirements (44px × 44px)
- 📐 **Responsive layouts** - Adaptive grid systems and flexible layouts that work on all screen sizes
- 🎨 **Responsive typography** - Text that scales appropriately for different devices
- 🚀 **Performance optimized** - Mobile-optimized loading states and interactions
- ♿ **Accessibility focused** - Mobile-optimized accessibility features

For detailed information about the mobile responsiveness implementation, see [MOBILE_RESPONSIVENESS.md](./MOBILE_RESPONSIVENESS.md).


## Firebase Setup & Deployment

This project includes Firebase Firestore and Storage security rules that need to be deployed to your Firebase project.

### Files

- `firestore.rules` - Security rules for Firestore database
- `storage.rules` - Security rules for Firebase Storage

### Deployment

To deploy these rules to your Firebase project:

1. Install Firebase CLI (if not already installed):
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project (if not already done):
   ```bash
   firebase init
   ```

4. Deploy the rules:
   ```bash
   firebase deploy --only firestore:rules,storage
   ```

### Important Notes

- Make sure to test these rules in a development environment first
- The rules include role-based access control for admin, teacher, and parent users
- Users must be authenticated to access any data
- Role information should be stored in the user's document in the `users` collection

### Comment System Features

The updated Firestore rules now include comprehensive support for:

- **Assignment Comments**: Users can read all comments, create comments (linked to their user ID), and edit/delete their own comments
- **Announcement Comments**: Same permissions as assignment comments
- **Role-based Moderation**: Teachers and admins can delete any comment for moderation purposes
- **Security**: All comment operations require authentication and proper user validation

### Date Handling

The application now properly handles different date formats:

- **Firestore Timestamps**: Automatically converted using `.toDate()`
- **Date Objects**: Handled directly
- **String Dates**: Parsed with fallback error handling
- **Invalid Dates**: Display friendly error messages instead of "Invalid Date"
