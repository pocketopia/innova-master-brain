# Security Specification: Master Brain Engine

## 1. Data Invariants
- Content must belong to one of the five platforms: `MVN`, `StreamShare`, `ArcHaven`, `HekticTV`, `VaultStream`.
- `ownerId` must match the authenticated user's UID.
- `createdAt` and `updatedAt` must be server timestamps.
- Users can only read their own private profiles but can read content from platforms if authenticated.

## 2. The Dirty Dozen (Test Payloads)
1. **Identity Spoofing**: Content creation with `ownerId != request.auth.uid`.
2. **Platform Poisoning**: Content with invalid `platform_id` (e.g., `Netflix`).
3. **Ghost Field**: Update content with `isVerified: true`.
4. **Timestamp Fraud**: Create content with a manual `createdAt` string.
5. **State Shortcut**: Update `status` to `approved` from a non-admin account.
6. **Large ID**: Content creation with a 2KB document ID.
7. **Cross-User Leak**: Get a user profile that isn't yours.
8. **Shadow List**: Query all content without a platform filter.
9. **Field Type Poisoning**: Set `rotation_credits` to a 1MB string.
10. **Immutable Gap**: Change `platform_id` after creation.
11. **PII Leak**: Get `users/{userId}` as another user.
12. **Recursive Attack**: Excessive nested lookups (mitigated by rule structure).

## 3. Test Results
*Rules follow the "Fortress" pattern with `isValidContent` checks on all writes.*
