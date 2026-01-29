-- Update existing Pimlico room names to A, B, C, D (by room_number 1-4)
UPDATE "rooms"
SET "name" = 'A'
WHERE "location_id" = (SELECT "id" FROM "locations" WHERE "name" = 'Pimlico')
  AND "room_number" = 1;
--> statement-breakpoint
UPDATE "rooms"
SET "name" = 'B'
WHERE "location_id" = (SELECT "id" FROM "locations" WHERE "name" = 'Pimlico')
  AND "room_number" = 2;
--> statement-breakpoint
UPDATE "rooms"
SET "name" = 'C'
WHERE "location_id" = (SELECT "id" FROM "locations" WHERE "name" = 'Pimlico')
  AND "room_number" = 3;
--> statement-breakpoint
UPDATE "rooms"
SET "name" = 'D'
WHERE "location_id" = (SELECT "id" FROM "locations" WHERE "name" = 'Pimlico')
  AND "room_number" = 4;
--> statement-breakpoint
-- Update existing Kensington room names to 1, 2, 3, 4, 5, 6 (by room_number 1-6)
UPDATE "rooms"
SET "name" = '1'
WHERE "location_id" = (SELECT "id" FROM "locations" WHERE "name" = 'Kensington')
  AND "room_number" = 1;
--> statement-breakpoint
UPDATE "rooms"
SET "name" = '2'
WHERE "location_id" = (SELECT "id" FROM "locations" WHERE "name" = 'Kensington')
  AND "room_number" = 2;
--> statement-breakpoint
UPDATE "rooms"
SET "name" = '3'
WHERE "location_id" = (SELECT "id" FROM "locations" WHERE "name" = 'Kensington')
  AND "room_number" = 3;
--> statement-breakpoint
UPDATE "rooms"
SET "name" = '4'
WHERE "location_id" = (SELECT "id" FROM "locations" WHERE "name" = 'Kensington')
  AND "room_number" = 4;
--> statement-breakpoint
UPDATE "rooms"
SET "name" = '5'
WHERE "location_id" = (SELECT "id" FROM "locations" WHERE "name" = 'Kensington')
  AND "room_number" = 5;
--> statement-breakpoint
UPDATE "rooms"
SET "name" = '6'
WHERE "location_id" = (SELECT "id" FROM "locations" WHERE "name" = 'Kensington')
  AND "room_number" = 6;
