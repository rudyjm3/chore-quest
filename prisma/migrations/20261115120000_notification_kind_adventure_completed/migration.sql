-- ADR 0022: a parent is notified once when a child finishes every chapter of an adventure.
ALTER TYPE "NotificationKind" ADD VALUE 'ADVENTURE_COMPLETED';
