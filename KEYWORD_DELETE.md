# Keyword Delete Feature

## Overview
Added delete functionality to remove keywords from projects. When a keyword is deleted, it's removed from:
1. Database (Keyword table)
2. Database (Ranking table - all historical rankings)
3. Redis cache (all paginated cache entries)

## Frontend Changes

### KeywordManagement Component
**File:** `apps/frontend/src/components/projects/KeywordManagement.tsx`

**Added:**
- New "Actions" column in the keywords table
- Delete button (trash icon) next to each keyword
- Confirmation dialog before deletion
- Loading state during deletion (spinning icon)
- Auto-reload keywords list after successful deletion

**UI/UX:**
- Red trash icon button
- Hover effect (darker red)
- Disabled state while deleting
- Confirmation prompt: "Are you sure you want to delete [keyword]?"
- Error handling with alert message

## Backend Changes

### API Endpoint
**Route:** `DELETE /api/keywords/:projectId/:keyword`
**File:** `apps/backend/src/routes/keywords.ts`

**Features:**
- Authentication required
- Project ownership verification
- URL-encoded keyword support
- Cache invalidation after deletion
- Success response with deleted keyword name

**Request:**
```
DELETE /api/keywords/6575ba93-d911-4bbb-98f4-63ab12ea6ad5/rivuletiq
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Keyword deleted successfully",
    "keyword": "rivuletiq"
  }
}
```

### Service Layer
**File:** `apps/backend/src/services/keyword/keywordService.ts`

**Updated `deleteKeyword()` function:**
1. Deletes all rankings for the keyword (from Ranking table)
2. Deletes the keyword (from Keyword table)
3. Logs the deletion

**File:** `apps/backend/src/services/keyword/cachedKeywordService.ts`

**Existing `deleteKeyword()` method:**
- Calls base service to delete from database
- Invalidates all cache entries (base + paginated) using pattern matching

## Cache Invalidation
When a keyword is deleted, the following cache keys are cleared:
- `keywords:{projectId}` (base cache)
- `keywords:{projectId}:page:*` (all paginated cache entries)

This ensures that:
- Next request fetches fresh data from database
- Deleted keyword doesn't appear in any cached page
- No stale data is served to users

## Database Operations
Deletion is performed in this order:
1. Delete rankings: `DELETE FROM Ranking WHERE projectId = ? AND keyword = ?`
2. Delete keyword: `DELETE FROM Keyword WHERE projectId = ? AND keyword = ?`

This prevents foreign key constraint issues and ensures complete cleanup.

## Security
- Authentication required (JWT token)
- Project ownership verified before deletion
- Only project owner can delete keywords
- Authorization error thrown if user doesn't own project

## Error Handling
- Invalid projectId → ValidationError
- Invalid keyword → ValidationError
- Not project owner → AuthorizationError
- Database errors → Logged and returned to client
- Cache errors → Logged but don't block deletion

## Testing
To test the delete functionality:
1. Open a project with keywords
2. Click the red trash icon next to any keyword
3. Confirm the deletion in the dialog
4. Keyword should disappear from the list
5. Refresh the page - keyword should still be gone
6. Check database - keyword and rankings should be deleted
7. Check cache - cache should be invalidated

## Related Files
- `apps/frontend/src/components/projects/KeywordManagement.tsx`
- `apps/backend/src/routes/keywords.ts`
- `apps/backend/src/services/keyword/keywordService.ts`
- `apps/backend/src/services/keyword/cachedKeywordService.ts`
