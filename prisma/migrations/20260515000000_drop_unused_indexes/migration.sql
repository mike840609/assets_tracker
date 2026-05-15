-- Drop indexes confirmed as never-used by pg_stat_user_indexes (0 idx_scan across full history).
-- Account_userId_idx is redundant — covered by Account_userId_isActive_idx (leftmost prefix).
-- Holding_symbol_idx and Holding_assetType_expiration_idx have never been read.
-- NetWorthSnapshot_userId_idx is covered by the (userId, date DESC) composite index.

DROP INDEX IF EXISTS "Account_userId_idx";
DROP INDEX IF EXISTS "Holding_symbol_idx";
DROP INDEX IF EXISTS "Holding_assetType_expiration_idx";
DROP INDEX IF EXISTS "NetWorthSnapshot_userId_idx";
