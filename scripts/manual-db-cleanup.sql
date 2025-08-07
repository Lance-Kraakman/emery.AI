-- Clean up test users that don't have OAuth accounts
-- Keep only users that have corresponding accounts table entries

-- First, let's see what we have
SELECT 'BEFORE CLEANUP - Users:' as info;
SELECT COUNT(*) as user_count FROM users;

SELECT 'BEFORE CLEANUP - OAuth Accounts:' as info;
SELECT COUNT(*) as account_count FROM accounts;

SELECT 'Users WITH OAuth accounts:' as info;
SELECT u.email, u.id, a.provider 
FROM users u 
JOIN accounts a ON u.id = a.user_id;

-- Delete users that don't have OAuth accounts
DELETE FROM users 
WHERE id NOT IN (
    SELECT DISTINCT user_id FROM accounts
);

-- Show final state
SELECT 'AFTER CLEANUP - Users:' as info;
SELECT COUNT(*) as user_count FROM users;

SELECT 'Remaining users:' as info;
SELECT u.email, u.id, u.organization_id, u.role_id, a.provider 
FROM users u 
JOIN accounts a ON u.id = a.user_id;