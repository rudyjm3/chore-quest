-- Adds a source type for one-time location rewards (ADR 0014). Existing rows are untouched.
ALTER TYPE "InventorySourceType" ADD VALUE 'LOCATION_REWARD';
