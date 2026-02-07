# Bonus Features

### 🍓 LOGIN
### 1. Press **Enter** to Log In
- Enhanced the login experience by enabling the **Enter** key to trigger the login action when the user finishes entering credentials.  
- This makes the login process faster and more intuitive, aligning with common UX expectations across modern web apps.

### 2. "Remember Me" Persistent Login
- Added a **"Remember Me"** option on the login page that allows users to stay logged in across browser sessions.  
- When this option is checked, the user’s authentication token is securely saved in `localStorage`, so they remain signed in even after closing or reopening the browser.  
- If the option is not selected, the token is only stored in `sessionStorage`, which expires once the browser tab is closed.

### 🍓 Chat box
### 1. Optimized Message Editing Dropdown
- Combined edit / delete / pin actions into a clean dropdown menu with consistent colors.
- Improved UI clarity and reduced clutter for each message.
- Demonstrates understanding of DOM structure manipulation and event delegation.

### 2. Pinned Message Highlight
- Added a subtle background color to pinned messages for better visual distinction.

### 3. Press **Enter** to Send Messages
- Implemented a keyboard shortcut that allows users to send a message by pressing **Enter** in the message input field.  
- This feature streamlines chatting by eliminating the need to manually click the "Send" button, improving overall interaction efficiency.

### 🍓 Invite
### 1. Real-Time Invite Selection Counter
- When inviting users to a channel, the interface now dynamically counts and displays how many users have been selected for invitation.  
- This provides immediate feedback to the user, reducing mistakes and improving usability when handling large member lists.

### 2. Fuzzy Search in User Invitation Modal
- Added a **real-time fuzzy search** bar inside the “Invite Members” modal.  
- Users can now quickly search for members to invite by typing part of a name or email address.  
- The list of available users dynamically filters as the user types, providing an efficient and intuitive way to locate specific members, especially in large classes or groups.

### 🍓 User
### 1. Default Avatar for Users Without Uploaded Photos
- Implemented a system-generated default avatar for users who have not uploaded a profile photo.  
- The placeholder avatar maintains consistent layout and visual balance in the message list and member view.

### 🍓 System
### 1. Theme Color Customization
- Unified color scheme using the project’s primary purple (#621f6a) across navbar and buttons.
