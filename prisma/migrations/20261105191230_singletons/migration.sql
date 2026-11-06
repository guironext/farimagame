-- Lignes uniques attendues par l'application : caisse, synchro sportive, cache des cotes.
INSERT INTO "house_accounts" ("id") VALUES ('house') ON CONFLICT ("id") DO NOTHING;
INSERT INTO "sports_sync" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;
INSERT INTO "odds_snapshots" ("id") VALUES ('default') ON CONFLICT ("id") DO NOTHING;
