# Testing

## 1. Component Testing

I used Jest with React Testing Library to test three different components.

### 1.1 SearchFilters

This component renders the search bar on the Homes page, including the "Where" text input, date pickers, price range, bedroom range and rating sort dropdown.

- **Test 1 – Where input**: type a value in the "Where" text field and assert that `setSearchWhere` is called with the correct string.
- **Test 2 – Search button**: click the search icon button and assert that the `onSearch` callback is called.
- **Test 3 – Rating sort**: open the rating `<Select>`, choose "Highest first", and assert that `setRatingOrder` is called with `"ratingDesc"`.

These tests check both controlled inputs and simple user interaction.

### 1.2 JsonUpload

This component is used in the Create Listing page to upload a JSON file and populate the form.

- **Test 1 – Valid JSON**: mock a `FileReader`, simulate selecting a valid `.json` file, and assert that `onUpload` is called with the parsed JavaScript object.
- **Test 2 – Invalid JSON**: mock `FileReader` to return invalid JSON, and assert that `onError` is called and an error message is displayed.

This focuses on file handling, error handling and boundary cases.

### 1.3 ReviewsSection

This component displays the average rating, total number of reviews and the list of individual reviews on the View Listing page.

- **Test 1 – Empty state**: render with an empty `reviews` array and assert that "No reviews yet" and "0 reviews" are shown.
- **Test 2 – Average rating & count**: render with three reviews and an `avgRating` of `4.6667`, and assert that "4.7" and "3 reviews" are displayed.
- **Test 3 – Review items**: render with two reviews and assert that two elements with `data-testid="review-item"` are rendered.

These tests verify that the component correctly renders rating information and the list of reviews.

## 2. UI Testing (Happy Path)

For UI testing, I used Cypress to implement the full “admin happy path”, ensuring that a host can create, publish, and manage listings, and that bookings remain visible after re-login. The automated test covers the following end-to-end workflow:

1. **Register a new host user.**
2. **Create a new listing** with title, address, price, metadata, and an uploaded thumbnail.
3. **Edit the listing**, including updating the title and thumbnail.
4. **Publish the listing** so that it becomes visible to other users.
5. **Log out and register a second user** to act as the guest.
6. **Book the published listing** by selecting valid check-in and check-out dates.
7. **Log out and log in again as the host.**
8. **Open the listing’s Manage Bookings page** and verify that the booking appears in the **Requests** tab.
9. **Accept the booking**, after which it moves to the **History** tab.
10. **Verify the accepted booking appears correctly in the History table**, including guest email, dates, nights, status, and price.

This end-to-end test confirms that:
- Listing creation and editing work correctly  
- Publishing/unpublishing functions behave as expected  
- A guest can successfully make a booking  
- Bookings persist and are visible after re-login  
- Accepting a booking updates the UI and moves it to the History tab  

The Cypress test script (`cypress/e2e/happyPath.cy.js`) automatically drives the browser through these steps to verify that the application behaves correctly end-to-end under a realistic usage scenario.
