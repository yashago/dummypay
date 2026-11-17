# Project: DummyPay – Virtual Payment Platform

## 1. Project Overview

Build a modern, responsive dummy payment platform that simulates a digital wallet and peer-to-peer money transfer application.

The platform must allow real registered users to interact with each other and transfer fictional funds between their accounts.

**Important distinction:**
- User accounts are real accounts registered on the platform.
- Money and balances are entirely fictional.
- No real money is deposited, withdrawn, transferred, or processed.
- No actual payment authorization or banking operations take place.

Users should be able to register, receive fictional funds, manage multiple currency wallets, send and receive money, and manage their virtual payment methods.

The application should have a professional fintech appearance, with a clean dashboard and intuitive navigation.

## 2. User Authentication and Registration

Implement user registration and login using email and password.

Requirements:
- Users can register with their email address and password.
- Each email address must be unique.
- Users can log in and log out.
- Passwords must be securely hashed.
- Implement proper authentication and session management.
- Users must only access their own financial information.
- Each user should have a profile containing:
  - User ID.
  - Email address.
  - Display name.
  - Registration date.
  - Preferred currency.

A user must be authenticated before accessing any wallet or financial functionality.

## 3. Virtual Wallet

Upon successful registration, each user receives an initial fictional balance.

Initial balances depend on the user's selected preferred currency:

| Currency | Initial Balance |
|---|---:|
| ILS | 13,000 |
| USD | 5,000 |
| EUR | 5,000 |
| GBP | 5,000 |

Initially support:
- ILS – Israeli Shekel.
- USD – US Dollar.
- EUR – Euro.
- GBP – British Pound.

Requirements:
- Each user can have multiple currency wallets.
- Each currency wallet maintains an independent balance.
- Users can view their current balance in each currency.
- Users can add additional currency wallets.
- Users can see their available balance for each currency.
- Initial balances are granted only once during account creation.
- Users must not be able to grant themselves additional funds through frontend requests or API manipulation.

All balances are fictional.

Use integer minor units (agorot, cents, etc.) for monetary calculations rather than floating-point arithmetic.

## 4. Currency Exchange

Integrate a real exchange-rate API to retrieve current currency conversion rates.

Requirements:
- Exchange rates must not be hardcoded.
- Display the latest available exchange rates.
- Support conversion between all supported currencies.
- Allow users to preview currency conversions.
- Store the exchange rate used for every completed transaction.
- Historical transactions must retain their original exchange rate.
- Use appropriate decimal precision and rounding rules.
- Handle API failures gracefully.
- Never execute a transfer using an invalid or unavailable exchange rate.

The exchange-rate API must be accessed securely. API secrets must never be exposed in frontend code.

Display the last exchange-rate update timestamp.

## 5. Money Transfers – Peer-to-Peer

Users must be able to send fictional money to other registered users.

**Critical business rule: Transfers are allowed ONLY between existing, registered platform users.**

The platform must never send money to arbitrary email addresses or create recipient accounts automatically.

### 5.1 Recipient Validation

The sender enters the recipient's email address.

Requirements:
- Validate the email format.
- Search for the recipient in the registered users database.
- Perform recipient lookup on the backend.
- If no matching registered user exists, reject the transfer.
- Display an appropriate error message: "No registered user found with this email address."
- If a matching user exists, display their email address and profile name for confirmation.
- Prevent users from sending money to themselves.
- Do not expose the entire users database through recipient lookup.
- Return only the minimum recipient information required for confirmation.
- Only authenticated users can initiate transfers.

Never create a recipient account automatically.

### 5.2 Transfer Process

The transfer flow should be:

1. User opens the Send Money section.
2. User enters the recipient's registered email address.
3. The backend validates that the recipient exists.
4. The recipient's name and email are displayed.
5. The sender enters the amount.
6. The sender selects the sending currency.
7. The sender selects the recipient's receiving currency.
8. The application retrieves the current exchange rate.
9. Display a transfer summary:
   - Sender.
   - Recipient.
   - Amount to send.
   - Sending currency.
   - Exchange rate.
   - Amount the recipient will receive.
10. Sender reviews and explicitly confirms the transfer.
11. Backend validates the transfer again and executes it.
12. Both users' wallets and transaction histories are updated.

### 5.3 Currency Handling

Example:

User A:
- Balance: ₪13,000.

User B:
- Balance: $5,000.

User A wants to send $100 to User B.

The platform should:
- Retrieve the current ILS/USD exchange rate.
- Calculate the ILS equivalent of $100.
- Deduct the corresponding amount in ILS from User A.
- Credit $100 to User B's USD wallet.
- Store the exchange rate and original amounts.

If the sender does not have sufficient funds, reject the transaction.

### 5.4 Transfer Validation

Implement the following validations:
- Recipient must exist.
- Sender must be authenticated.
- Sender and recipient cannot be the same user.
- Amount must be greater than zero.
- Amount must be within supported monetary precision.
- Sender must have sufficient funds.
- Sending and receiving currencies must be supported.
- Exchange rate must be valid.
- Duplicate transfers must be prevented.
- Invalid or manipulated requests must be rejected.

### 5.5 Transaction Integrity

Money transfers must be atomic database transactions.

Either:
- Sender is debited and recipient is credited.

Or:
- Neither operation takes place.

Never allow partial transfers.

Implement appropriate database locking or concurrency control to prevent race conditions when multiple transfers happen simultaneously.

Use idempotency protection to prevent duplicate transfers caused by repeated requests, network retries, or accidental double-clicks.

The backend must be the only authority allowed to modify wallet balances.

## 6. Transaction History

Each user should have a complete transaction history.

Display:
- Transaction ID.
- Date and time.
- Sender.
- Recipient.
- Transaction type (Sent / Received).
- Transaction amount.
- Sending currency.
- Receiving amount and currency.
- Exchange rate, when applicable.
- Transaction status.

Requirements:
- Users can only see transactions involving their own accounts.
- Display sent and received transactions clearly.
- Support filtering by:
  - Date range.
  - Transaction type.
  - Currency.
- Display transaction details when a transaction is selected.
- Historical transaction data must never be modified when exchange rates change.

## 7. Payment Cards

Users should be able to add and remove virtual payment cards.

Card information:
- Cardholder name.
- Card number.
- Expiration month.
- Expiration year.
- CVV.

Validation requirements:
- Card number must pass the Luhn algorithm.
- Expiration date must follow the MM/YY format.
- CVV must follow the expected numeric format.
- No actual payment authorization is required.
- Cards are simulated and are not connected to payment processors.

Security:
- Never store CVV values.
- Avoid storing full card numbers.
- Store only the last four digits, card brand, and a mock card identifier.
- Clearly indicate that cards are simulated.
- Do not imply that a card has been verified by a financial institution.

## 8. Bank Accounts

Users should be able to add and remove virtual bank accounts.

Information:
- Account holder name.
- Bank name.
- Account number or IBAN.
- Country.
- Currency.

Requirements:
- Validate basic formatting where appropriate.
- Do not connect to actual banks.
- Do not initiate real bank transfers.
- Do not store unnecessary sensitive banking information.
- Clearly mark all accounts as simulated.

## 9. Notifications

Implement real-time in-app notifications.

When a user receives money:
- Display an in-app notification.
- Show a modal or popup notification.
- Include sender's display name and email.
- Include the received amount and currency.
- Update the recipient's wallet balance immediately.
- Add the transaction to their transaction history.

Additional requirements:
- Notifications should be accessible through a notification center.
- Users can mark notifications as read.
- Users can view previous notifications.
- Notifications should be associated with the correct user.
- Users must never see another user's notifications.

Use a real-time mechanism such as Supabase Realtime if Supabase is used as the backend.

Notifications must be generated only after a successful transaction has committed.

## 10. Dashboard and User Interface

Create a modern fintech dashboard.

Main navigation sections:

1. Dashboard.
2. Wallets.
3. Send Money.
4. Transaction History.
5. Payment Cards.
6. Bank Accounts.
7. Notifications.
8. Profile and Settings.

### Dashboard

Display:
- Total wallet balances.
- Individual currency balances.
- Recent transactions.
- Quick action to send money.
- Current exchange rates.
- Recent notifications.

The dashboard should provide a clear overview of the user's virtual financial activity.

### Design Requirements

- Professional fintech appearance.
- Modern and clean interface.
- Responsive desktop and mobile layouts.
- Clear typography.
- Consistent spacing and colors.
- Intuitive navigation.
- Loading states.
- Error messages.
- Success notifications.
- Confirmation dialogs for financial operations.
- Empty states when no transactions or payment methods exist.

Make the interface feel like a real financial application while clearly identifying it as a simulated platform.

## 11. Database Architecture

Use a persistent database.

Suggested entities:

### Users
- id
- email
- display_name
- preferred_currency
- created_at

Authentication credentials should be managed by the authentication provider, not stored directly in the users table.

### Wallets
- id
- user_id
- currency
- balance
- created_at
- updated_at

Each user can have multiple wallets, one per supported currency.

Enforce a unique constraint on user_id and currency.

### Transactions
- id
- sender_user_id
- recipient_user_id
- sender_wallet_id
- recipient_wallet_id
- sending_amount
- sending_currency
- receiving_amount
- receiving_currency
- exchange_rate
- status
- idempotency_key
- created_at

### Payment Cards
- id
- user_id
- cardholder_name
- card_brand
- last_four_digits
- expiration_month
- expiration_year
- mock_card_token
- created_at

Never store CVV.

### Bank Accounts
- id
- user_id
- account_holder_name
- bank_name
- country
- currency
- masked_account_identifier
- created_at

### Notifications
- id
- user_id
- transaction_id
- title
- message
- is_read
- created_at

Use appropriate foreign keys, indexes, constraints, and database-level access policies.

## 12. Security Requirements

Security is a priority even though this is a dummy platform.

Implement:
- Secure authentication.
- Proper authorization.
- User-level data access restrictions.
- Database Row Level Security (RLS), if using Supabase.
- Backend validation of all financial operations.
- Server-side balance calculations.
- Atomic transactions.
- Protection against duplicate transfers.
- Protection against unauthorized balance modifications.
- Secure API secret management.
- Input validation and sanitization.
- Appropriate error handling.

Never trust frontend calculations or frontend-supplied user IDs when determining the authenticated sender.

The authenticated user's identity must come from the server-verified authentication session.

## 13. Technical Requirements

Preferred implementation:
- Frontend: React with TypeScript.
- Backend: Supabase.
- Database: PostgreSQL.
- Authentication: Supabase Auth.
- Real-time updates: Supabase Realtime.
- Styling: Modern responsive component-based design.

Use Lovable's recommended integrations where appropriate.

Keep the application modular and maintainable.

Use reusable components and separate business logic from presentation.

All important operations must persist in the database.

Do not implement financial functionality using frontend-only state or local mock data.

## 14. Development Guidelines

Follow these principles throughout development:

1. Do not make assumptions about unspecified business rules.
2. Ask for clarification when an important requirement is ambiguous.
3. Do not implement fake functionality that only changes the frontend.
4. Every operation that changes financial data must persist in the database.
5. Implement proper error handling.
6. Use reusable components.
7. Keep the architecture modular.
8. Ensure all database operations respect user authorization.
9. Do not expose sensitive information.
10. Test business logic before considering a feature complete.

## 15. Implementation Plan

Build the application incrementally.

Do not attempt to implement all functionality in one step.

### Phase 1 – Foundation
- Authentication.
- Registration and login.
- User profiles.
- Database schema.
- Initial wallet creation and balance allocation.

### Phase 2 – Wallets and Currency
- Multiple currency wallets.
- Exchange-rate API integration.
- Currency conversion preview.
- Balance display.

### Phase 3 – Peer-to-Peer Transfers
- Registered recipient lookup.
- Recipient validation.
- Transfer confirmation.
- Currency conversion.
- Atomic balance updates.
- Transaction history.

### Phase 4 – Notifications
- Real-time notifications.
- Incoming payment notifications.
- Notification center.

### Phase 5 – Payment Methods
- Virtual payment cards.
- Virtual bank accounts.
- Validation and management.

### Phase 6 – Testing and Security
- Authentication and authorization tests.
- Database access tests.
- Transfer validation tests.
- Insufficient balance tests.
- Currency conversion tests.
- Concurrent transfer tests.
- Duplicate transfer tests.
- Notification tests.
- Cross-user data access tests.

**Start with Phase 1.**

Before moving to the next phase, ensure the current phase is fully implemented, connected to the database, and tested.

Do not sacrifice backend correctness for visual completeness.