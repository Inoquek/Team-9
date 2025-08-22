# Firebase Security Rules Deployment Guide

## Overview
This guide explains how to deploy the Firebase security rules to fix the storage permissions and Firestore access issues.

## Prerequisites
1. Firebase CLI installed: `npm install -g firebase-tools`
2. Logged into Firebase: `firebase login`
3. Project initialized: `firebase init`

## Files to Deploy

### 1. Storage Rules (`storage.rules`)
Controls access to Firebase Storage files.

### 2. Firestore Rules (`firestore.rules`)
Controls access to Firestore database collections.

## Deployment Steps

### Step 1: Initialize Firebase (if not already done)
```bash
firebase init
```

Select:
- Firestore
- Storage
- Hosting (optional)

### Step 2: Deploy Storage Rules
```bash
firebase deploy --only storage
```

### Step 3: Deploy Firestore Rules
```bash
firebase deploy --only firestore
```

### Step 4: Verify Deployment
```bash
firebase projects:list
firebase use [your-project-id]
```

## Security Rules Explained

### Storage Rules
- **Assignments**: Teachers can upload to `/assignments/{classId}/{teacherId}/{timestamp}/`
- **Announcements**: Teachers can upload to `/announcements/{classId}/{teacherId}/{timestamp}/`
- **Profiles**: Users can upload their own profile pictures
- **Submissions**: Students/parents can upload assignment submissions

### Firestore Rules
- **Users**: Users can read/write their own documents, admins can access all
- **Classes**: Teachers can manage their assigned classes
- **Assignments**: Teachers can create/manage assignments for their classes
- **Announcements**: Teachers can create/manage announcements for their classes
- **Submissions**: Students can submit, teachers can review

## Testing Rules

### Test Storage Access
```bash
# Test file upload (should work for authenticated teachers)
firebase storage:rules:test storage.rules
```

### Test Firestore Access
```bash
# Test database access (should work for authenticated users)
firebase firestore:rules:test firestore.rules
```

## Troubleshooting

### Common Issues

1. **403 Unauthorized Error**
   - Check if user is authenticated
   - Verify user has correct role/permissions
   - Check if security rules are deployed

2. **Storage Permission Denied**
   - Ensure storage rules are deployed
   - Check file path structure matches rules
   - Verify user authentication

3. **Firestore Permission Denied**
   - Ensure firestore rules are deployed
   - Check user authentication status
   - Verify user role and class assignments

### Debug Steps

1. **Check Authentication**
   ```javascript
   console.log('User:', auth.currentUser);
   console.log('User ID:', auth.currentUser?.uid);
   ```

2. **Check File Paths**
   ```javascript
   console.log('Upload path:', basePath);
   console.log('File:', file.name);
   ```

3. **Check User Role**
   ```javascript
   console.log('User role:', user?.role);
   console.log('Class ID:', classId);
   ```

## Security Best Practices

1. **Always authenticate users** before allowing file uploads
2. **Use specific paths** for different file types
3. **Validate file types** and sizes on the client
4. **Implement rate limiting** for file uploads
5. **Regular security audits** of access patterns

## File Structure

```
assignments/
├── {classId}/
│   └── {teacherId}/
│       └── {timestamp}/
│           └── {filename}

announcements/
├── {classId}/
│   └── {teacherId}/
│       └── {timestamp}/
│           └── {filename}

profiles/
└── {userId}/
    └── {filename}

submissions/
├── {assignmentId}/
│   └── {userId}/
│       └── {filename}
```

## Support

If you encounter issues:
1. Check Firebase Console for error logs
2. Verify security rules syntax
3. Test with Firebase CLI tools
4. Check user authentication status
5. Review file path structure
