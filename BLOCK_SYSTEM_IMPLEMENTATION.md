# Block/Unblock User System Implementation

## Overview
Implemented a comprehensive user blocking system for the Avatar Bot Mini App, allowing administrators to block/unblock users through the admin panel.

## Features

### 1. Block/Unblock Users
- Admins can block users to prevent access to the app
- Blocked users see an error message when opening the app
- Admins can manually unblock users at any time

### 2. Auto-Unblock on Star Addition
- When adding stars to a blocked user, they are automatically unblocked
- This allows admins to "forgive" users by giving them stars

### 3. Admin Panel Integration
- Visual indicators: 🟢 for active users, 🔴 for blocked users
- Block/Unblock buttons next to each user in the top users list
- Confirmation dialog before blocking

## Implementation Details

### Database Changes
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked BOOLEAN DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_users_blocked ON users(blocked);
```

### n8n Workflows

#### 1. [MINIAPP] block-user (ID: KiYTLoH2eIPmE4aN)
- Endpoint: `POST /webhook/block-user`
- Request: `{ password, username, blocked }`
- Response: `{ id, username, blocked }`
- Password protected (123hors456)

#### 2. [MINIAPP] add-stars (Updated)
- Added auto-unblock: `SET blocked = FALSE` when adding stars
- Returns blocked field in response

#### 3. [MINIAPP] user-status (Updated)
- Returns `blocked` field in user status
- Used by frontend to check if user is blocked on app load

#### 4. [MINIAPP] admin-stats (Updated)
- Returns `blocked` field for each user in top_users list
- Query: `SELECT id, username, star_balance, COALESCE(blocked, FALSE) as blocked FROM users`

### Frontend Changes

#### 1. src/utils/api.js
Added `blockUser` function:
```javascript
export async function blockUser(password, username, blocked) {
  return apiRequest('block-user', { password, username, blocked });
}
```

#### 2. src/components/AdminPanel.jsx
- Import `blockUser` from api.js
- Added `blockLoading` state to track which user is being blocked
- Added `handleBlockUser` function with confirmation dialog
- Updated user list UI:
  - Show blocked status (🟢/🔴) next to each user
  - Show Block/Unblock button next to each user
  - Button text changes based on blocked state

#### 3. src/App.jsx
- Added `isBlocked` state
- Updated `loadUserStatus` to check blocked status
- If user is blocked:
  - Show error screen with message: "Ваш аккаунт заблокирован"
  - Prevent all app functionality

## User Experience

### For Blocked Users
1. User opens the app
2. App loads user status from server
3. If `blocked: true`, show error screen immediately
4. Error message: "Ваш аккаунт заблокирован. Если вы считаете что это ошибка, свяжитесь с поддержкой."
5. User cannot access any app features

### For Admins
1. Open admin panel (triple-tap "AI" in header)
2. See all top users with blocked status indicators
3. Click Block/Unblock button next to user
4. Confirmation dialog appears
5. After confirmation, user is blocked/unblocked
6. Stats refresh automatically

### Auto-Unblock Flow
1. Admin adds stars to a blocked user via admin panel
2. System automatically sets `blocked = FALSE`
3. User can immediately access the app again
4. New balance is displayed in admin panel

## Testing

All endpoints tested and working:
- ✅ Block user endpoint
- ✅ Unblock user endpoint
- ✅ Add stars with auto-unblock
- ✅ User status returns blocked field
- ✅ Admin stats returns blocked field for all users
- ✅ Frontend checks blocked status on load

## Security

- All admin operations require password (123hors456)
- Block/unblock requires username (not user_id) for safety
- Confirmation dialog prevents accidental blocks
- Blocked status checked on every app load
