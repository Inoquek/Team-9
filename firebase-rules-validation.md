# Firebase Rules Validation Guide

This guide helps you validate that your new Firebase rules are working correctly for the parent assignment submission system.

## Firestore Rules Validation

### 1. Study Time Collection Access

**Test Case: Parent Reading Their Child's Study Time**
```javascript
// As a parent user
const parentUid = "parent123";
const studentId = "student456";
const date = "2024-01-15";
const studyTimeId = `${studentId}_${date}`;

// This should succeed
const studyTimeRef = doc(db, 'studyTime', studyTimeId);
const studyTime = await getDoc(studyTimeRef);
```

**Test Case: Parent Writing Their Child's Study Time**
```javascript
// As a parent user
const studyTimeData = {
  studentId: "student456",
  date: "2024-01-15",
  totalMinutes: 45,
  assignmentsCompleted: 2,
  lastUpdated: new Date()
};

// This should succeed
await setDoc(studyTimeRef, studyTimeData);
```

**Test Case: Teacher Reading Student Study Time**
```javascript
// As a teacher
// This should succeed if the student is in the teacher's class
const studyTime = await getDoc(studyTimeRef);
```

**Test Case: Unauthorized Access**
```javascript
// As a different parent (not the student's parent)
// This should fail
const unauthorizedParent = "otherParent789";
// Should throw permission denied error
```

### 2. Submission Collection with New Fields

**Test Case: Parent Creating Submission with Completion Time**
```javascript
// As a parent
const submissionData = {
  assignmentId: "assignment123",
  studentId: "student456",
  parentId: "parent123",
  files: [],
  completionTimeMinutes: 30, // NEW FIELD
  studyTimeToday: 120, // NEW FIELD
  submittedAt: new Date(),
  status: 'pending',
  points: 0
};

// This should succeed
const submissionRef = await addDoc(collection(db, 'submissions'), submissionData);
```

**Test Case: Parent Updating Submission Status**
```javascript
// As a parent
// This should succeed
await updateDoc(submissionRef, {
  status: 'needsRevision',
  updatedAt: new Date()
});
```

## Storage Rules Validation

### 1. Submission File Uploads

**Test Case: Parent Uploading Submission Files**
```javascript
// As a parent
const file = new File(['content'], 'assignment.pdf', { type: 'application/pdf' });
const uploadPath = `submissions/assignment123/parent123/${Date.now()}_assignment.pdf`;

// This should succeed
const storageRef = ref(storage, uploadPath);
await uploadBytes(storageRef, file);
```

**Test Case: Teacher Uploading on Behalf of Student**
```javascript
// As a teacher
const uploadPath = `submissions/assignment123/student456/${Date.now()}_assignment.pdf`;

// This should succeed
const storageRef = ref(storage, uploadPath);
await uploadBytes(storageRef, file);
```

**Test Case: Unauthorized Upload**
```javascript
// As a different user
const uploadPath = `submissions/assignment123/otherUser789/${Date.now()}_assignment.pdf`;

// This should fail
const storageRef = ref(storage, uploadPath);
// Should throw permission denied error
```

## Testing Commands

### 1. Deploy Rules
```bash
# Deploy Firestore rules
firebase deploy --only firestore:rules

# Deploy Storage rules
firebase deploy --only storage:rules
```

### 2. Test Rules Locally (Optional)
```bash
# Install Firebase emulator
npm install -g firebase-tools

# Start emulator
firebase emulators:start

# Test rules in emulator
firebase emulators:exec --only firestore "npm test"
```

## Common Issues and Solutions

### 1. Permission Denied Errors

**Problem**: Users can't read/write study time data
**Solution**: Check that the user's role and relationships are properly set in the database

**Problem**: File uploads failing
**Solution**: Verify the user has the correct role and is uploading to the right path

### 2. Rule Evaluation Issues

**Problem**: Rules are too complex and timing out
**Solution**: Simplify rule logic, avoid deep nesting, use indexes for complex queries

**Problem**: Rules not working as expected
**Solution**: Use Firebase console to test rules with sample data

## Security Best Practices

1. **Principle of Least Privilege**: Only grant the minimum permissions necessary
2. **Validate Data**: Ensure data structure matches expected format
3. **Test Thoroughly**: Test rules with various user roles and data scenarios
4. **Monitor Usage**: Use Firebase console to monitor rule evaluation and access patterns
5. **Regular Review**: Periodically review and update rules as your app evolves

## Debugging Rules

### 1. Enable Rule Logging
```javascript
// In your Firebase config
const db = getFirestore(app);
enableNetworkStatus(db);
```

### 2. Check Firebase Console
- Go to Firestore > Rules
- Use the "Rules Playground" to test rules
- Check the "Usage" tab for rule evaluation statistics

### 3. Common Debug Patterns
```javascript
// Add logging to understand rule evaluation
match /studyTime/{studyTimeId} {
  allow read: if request.auth != null && (
    // Log the evaluation
    print("User:", request.auth.uid);
    print("Student ID:", resource.data.studentId);
    // ... rest of rule
  );
}
```

## Performance Considerations

1. **Indexes**: Create composite indexes for complex queries
2. **Rule Complexity**: Keep rules simple to avoid evaluation timeouts
3. **Data Structure**: Design your data model to minimize rule complexity
4. **Caching**: Use client-side caching to reduce rule evaluation frequency

## Next Steps

1. **Deploy the updated rules** to your Firebase project
2. **Test the new functionality** with parent users
3. **Monitor rule performance** in the Firebase console
4. **Adjust rules** based on actual usage patterns
5. **Document any customizations** for your team
