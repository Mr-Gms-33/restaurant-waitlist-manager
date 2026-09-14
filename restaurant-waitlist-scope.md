# Restaurant Waitlist Manager — Project Scope

## Product Goal

Build a simple waitlist management tool for an independent restaurant, beginning with a single pilot location.

## Confirmed Decisions

- **Target customer:** Independent restaurants
- **Initial rollout:** One pilot restaurant
- **Guest entry:** Guests can join the waitlist remotely
- **Guest interface:** Mobile web page with no account required
- **Guest notifications:** Live browser status page
- **Staff interface:** Responsive web dashboard
- **Wait-time estimates:** Entered manually by staff
- **Table management:** Track table number, capacity, and status
- **Arrival confirmation:** Guests tap “I’m here” before a deadline
- **Missed guest handling:** Staff decides what to do in each case

## Proposed MVP Workflow

1. A guest opens the restaurant’s waitlist link.
2. The guest enters their name, party size, and basic contact or identification details.
3. The system adds the party to the queue and displays its status.
4. Staff reviews and manages the queue from a responsive dashboard.
5. Staff manually sets or updates estimated wait times.
6. Before arriving, the guest taps **I’m here** within the required window.
7. Staff marks a suitable table as available and assigns it to a party.
8. The guest’s browser page shows that the table is ready.
9. Staff marks the party as seated, cancelled, or a no-show.

## MVP Features

### Guest Experience

- Join remotely without creating an account
- Enter party details
- View queue status and estimated wait
- Confirm arrival
- See when the table is ready
- Leave the waitlist

### Staff Dashboard

- View active waiting parties
- Add, edit, reorder, or remove parties
- Set estimated wait times manually
- See which guests have confirmed arrival
- Mark parties as ready, seated, cancelled, or no-show
- Choose how to handle guests who do not respond
- Manage tables and their current status

### Table Tracking

- Table number or name
- Seating capacity
- Status: available, occupied, or unavailable
- Current party assignment

## Suggested Party Statuses

- Waiting
- Arrival confirmed
- Table ready
- Seated
- Cancelled
- No-show

## Out of Scope for the First Pilot

- Native mobile apps
- Guest accounts and profiles
- SMS or WhatsApp notifications
- Visual restaurant floor plan
- Fully automatic wait-time prediction
- Multiple restaurant locations
- Payments
- Loyalty programs
- Advanced analytics

## Decisions Still Open

- Whether advance reservations should be excluded, supported, or planned for later
- What information guests must provide
- How long guests have to confirm arrival
- Whether remote joining is limited by time, distance, or restaurant capacity
- Whether the browser must remain open to receive table-ready updates
- Staff login roles and permissions
- Data retention and privacy rules
- Required reporting for the pilot

## Pilot Success Criteria

- Guests can join and track their place without staff assistance
- Staff can manage the full waitlist from one dashboard
- Staff can match parties to appropriately sized tables
- Queue and table statuses remain accurate during service
- The workflow reduces manual tracking and guest uncertainty
