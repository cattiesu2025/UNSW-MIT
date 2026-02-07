# Bonus Features (Solo Submission)

This project was completed individually.  
As a solo student, I implemented *all features* described in the specification, as well as several additional functional and aesthetic enhancements.  
All features listed below are fully implemented and tested.

---

# 1. Prevent Deletion of Listings with Active Bookings (Business Rule Protection)

- Before allowing a listing to be deleted, the system checks whether it has any active bookings (pending or accepted).
- If such bookings exist, deletion is blocked and a custom error dialog is shown instead of a standard browser alert.
- This prevents users (hosts) from accidentally deleting listings that still have active reservations, improving data consistency and system integrity.
- This is not part of base requirements – implemented as a bonus feature.

---

# 2. Intelligent Booking Date Validation

- Users cannot select dates before today (including yesterday or any past date).
- The system dynamically checks the listing’s availability ranges and disables any dates that are outside of the available periods.
- Implemented using MUI `DatePicker` with `shouldDisableDate` and custom validation logic.
- This prevents invalid booking attempts and ensures that users can only book within the allowed date ranges.
- Improves both **business logic consistency** and **user experience**, reducing potential booking conflicts.

---

# 3: Notification deep-links to listing pages

- When a **host** clicks a booking notification, the app navigates directly to the **manage page** of that listing (`/listings/:id/manage`), so the host can immediately approve/decline or review bookings for that property.
- When a **guest** clicks a booking notification, the app navigates to the **public view page** of that listing (`/listings/:id`), where the guest can see the property details **plus their booking status** (e.g., pending / accepted / declined) of that listing.
- Each notification stores the related `listingId` (and `bookingId` where needed). On click, we use React Router’s `useNavigate()` to route to the correct page with the corresponding booking information pre-loaded.
