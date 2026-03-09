# updatedByEmail Fix Documentation

## Problem
When creating new projects, the `updatedByEmail` field was being set even though the project had never been edited. This was incorrect behavior.

## Expected Behavior
- **New projects**: `updatedByEmail` should be `null`
- **Edited projects**: `updatedByEmail` should contain the email of the user who last edited the project
- `updatedAt` is automatically managed by Prisma and always has a value

## What Was Fixed

### 1. Project Creation (projectService.ts)
The `create()` function was already correct - it does NOT set `updatedByEmail` on creation:

```typescript
const project = await prisma.project.create({
  data: {
    userId,
    ownerEmail: userEmail,
    domain,
    name: name || domain,
    createdByEmail: userEmail,
    // updatedByEmail is NOT set here - remains null
  },
});
```

### 2. Project Update (projectService.ts)
The `update()` function correctly sets `updatedByEmail` when a project is edited:

```typescript
const updatedProject = await prisma.project.update({
  where: { id: projectId },
  data: {
    ...data,
    updatedByEmail: userEmail, // Set only when actually updated
  },
});
```

### 3. Backfill Script (backfill-creator-emails.ts)
Updated the backfill script to NOT set `updatedByEmail` by default:

**Before:**
```typescript
// Set updatedByEmail if null (use creator's email as default)
if (!project.updatedByEmail) {
  updateData.updatedByEmail = project.user.email;
}
```

**After:**
```typescript
// DO NOT set updatedByEmail - it should only be set when project is actually edited
// updatedByEmail should remain null for newly created projects
```

### 4. Database Cleanup
Created and ran `reset-updated-by-email.ts` script to clear `updatedByEmail` for all existing projects:

```bash
npx ts-node scripts/reset-updated-by-email.ts
```

This reset all projects to have `updatedByEmail = null`, providing a clean slate.

## Verification

After the fix, the database shows:

```
Domain: www.s.com
Name: S
Owner Email: support@whitelabeliq.com
Created By: support@whitelabeliq.com
Created At: 2026-03-09T14:30:55.955Z
Updated At: 2026-03-09T14:43:57.526Z
Updated By: null  ✓ (correct - never edited)
Deleted At: null
Deleted By: null
```

## Testing

To test the fix:

1. **Create a new project** - `updatedByEmail` should be `null`
2. **Edit the project** - `updatedByEmail` should be set to the editor's email
3. **View the project** - `updatedByEmail` should remain set after editing

## Scripts Created

1. `clear-updated-by-for-new-projects.ts` - Clears updatedByEmail for projects where updatedAt equals createdAt
2. `fix-updated-by-email.ts` - More comprehensive version with detailed logging
3. `reset-updated-by-email.ts` - Resets all projects to null (used for cleanup)
4. `verify-projects.ts` - Displays all project data for verification

## Summary

The fix ensures that:
- ✓ New projects have `updatedByEmail = null`
- ✓ Only edited projects have `updatedByEmail` set
- ✓ Backfill script won't incorrectly set `updatedByEmail`
- ✓ Existing projects were cleaned up
