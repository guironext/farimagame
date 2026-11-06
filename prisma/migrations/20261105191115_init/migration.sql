-- CreateEnum
CREATE TYPE "Role" AS ENUM ('JOUEUR', 'ADMIN');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('normal', 'pro');

-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('coris', 'lions', 'fcfa');

-- CreateEnum
CREATE TYPE "GameCurrency" AS ENUM ('coris', 'lions');

-- CreateEnum
CREATE TYPE "GameId" AS ENUM ('ludo', 'dames', 'awale', 'echecs');

-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('cpu', '2', '3', '4');

-- CreateEnum
CREATE TYPE "TableStatus" AS ENUM ('waiting', 'playing', 'finished', 'cancelled');

-- CreateEnum
CREATE TYPE "MatchSource" AS ENUM ('demo', 'api-football', 'manuel');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('scheduled', 'live', 'finished', 'postponed', 'cancelled');

-- CreateEnum
CREATE TYPE "MarketId" AS ENUM ('1N2', 'BTTS', 'OU25');

-- CreateEnum
CREATE TYPE "Selection" AS ENUM ('1', 'N', '2', 'oui', 'non', 'plus', 'moins');

-- CreateEnum
CREATE TYPE "BetStatus" AS ENUM ('pending', 'won', 'lost', 'refunded');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('bonus', 'mise', 'gain', 'nul', 'remboursement', 'conversion_debit', 'conversion_credit', 'depot', 'retrait', 'retrait_annule', 'pari', 'gain_pari', 'remboursement_pari');

-- CreateEnum
CREATE TYPE "HouseTxType" AS ENUM ('commission', 'mise_ordinateur', 'gain_ordinateur', 'nul_ordinateur', 'remboursement_ordinateur', 'commission_pari', 'arrondi_pari');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('depot', 'retrait');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'completed', 'failed', 'rejected');

-- CreateEnum
CREATE TYPE "MobileOperator" AS ENUM ('orange', 'mtn', 'wave', 'moov');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "username_lower" TEXT NOT NULL,
    "clerk_id" TEXT,
    "email" TEXT,
    "password_hash" TEXT,
    "salt" TEXT,
    "role" "Role" NOT NULL DEFAULT 'JOUEUR',
    "level" "Level" NOT NULL DEFAULT 'normal',
    "coris" INTEGER NOT NULL DEFAULT 0,
    "lions" INTEGER NOT NULL DEFAULT 0,
    "fcfa" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL,
    "pro_since" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "token" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "table_id" TEXT,
    "match_id" TEXT,
    "payment_id" TEXT,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_accounts" (
    "id" TEXT NOT NULL DEFAULT 'house',
    "coris" INTEGER NOT NULL DEFAULT 0,
    "lions" INTEGER NOT NULL DEFAULT 0,
    "fcfa" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "house_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "house_ledger" (
    "id" TEXT NOT NULL,
    "house_id" TEXT NOT NULL DEFAULT 'house',
    "type" "HouseTxType" NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" INTEGER NOT NULL,
    "table_id" TEXT,
    "match_id" TEXT,
    "label" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "house_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_tables" (
    "id" TEXT NOT NULL,
    "game" "GameId" NOT NULL,
    "mode" "GameMode" NOT NULL,
    "currency" "GameCurrency" NOT NULL,
    "stake" INTEGER NOT NULL,
    "max_players" INTEGER NOT NULL,
    "status" "TableStatus" NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "last_move_at" TIMESTAMP(3),
    "winner_seat" INTEGER,
    "is_draw" BOOLEAN NOT NULL DEFAULT false,
    "pot" INTEGER NOT NULL DEFAULT 0,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "commission" INTEGER NOT NULL DEFAULT 0,
    "state" JSONB NOT NULL,
    "log" TEXT[],
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "game_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seats" (
    "table_id" TEXT NOT NULL,
    "seat" INTEGER NOT NULL,
    "user_id" TEXT,
    "username" TEXT NOT NULL,
    "is_cpu" BOOLEAN NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "seats_pkey" PRIMARY KEY ("table_id","seat")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "source" "MatchSource" NOT NULL,
    "competition_id" TEXT NOT NULL,
    "home" TEXT NOT NULL,
    "away" TEXT NOT NULL,
    "home_logo" TEXT,
    "away_logo" TEXT,
    "kickoff" TIMESTAMP(3) NOT NULL,
    "status" "MatchStatus" NOT NULL,
    "home_score" INTEGER,
    "away_score" INTEGER,
    "live" JSONB,
    "round" TEXT,
    "venue" TEXT,
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "settled_at" TIMESTAMP(3),
    "settlement" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "market" "MarketId" NOT NULL,
    "selection" "Selection" NOT NULL,
    "stake" INTEGER NOT NULL,
    "status" "BetStatus" NOT NULL,
    "payout" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "settled_at" TIMESTAMP(3),

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "operator" "MobileOperator" NOT NULL,
    "phone" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_ref" TEXT,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sports_sync" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT,
    "last_sync_at" TIMESTAMP(3),
    "last_error" TEXT,
    "last_live_at" TIMESTAMP(3),
    "last_live_error" TEXT,
    "quota_day" TEXT,
    "quota_used" INTEGER,
    "quota_remaining" INTEGER,
    "quota_limit" INTEGER,

    CONSTRAINT "sports_sync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_snapshots" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "events" JSONB NOT NULL DEFAULT '[]',
    "fetched_at" TIMESTAMP(3),
    "next_at" TIMESTAMP(3),
    "remaining" INTEGER,
    "used" INTEGER,
    "last_error" TEXT,
    "status" TEXT,
    "sports" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "odds_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_lower_key" ON "users"("username_lower");

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_table_id_idx" ON "transactions"("table_id");

-- CreateIndex
CREATE INDEX "transactions_match_id_idx" ON "transactions"("match_id");

-- CreateIndex
CREATE INDEX "house_ledger_created_at_idx" ON "house_ledger"("created_at");

-- CreateIndex
CREATE INDEX "game_tables_status_game_idx" ON "game_tables"("status", "game");

-- CreateIndex
CREATE INDEX "seats_user_id_idx" ON "seats"("user_id");

-- CreateIndex
CREATE INDEX "matches_status_kickoff_idx" ON "matches"("status", "kickoff");

-- CreateIndex
CREATE INDEX "matches_competition_id_idx" ON "matches"("competition_id");

-- CreateIndex
CREATE INDEX "bets_user_id_created_at_idx" ON "bets"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "bets_match_id_status_idx" ON "bets"("match_id", "status");

-- CreateIndex
CREATE INDEX "payments_user_id_created_at_idx" ON "payments"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "game_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_ledger" ADD CONSTRAINT "house_ledger_house_id_fkey" FOREIGN KEY ("house_id") REFERENCES "house_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_ledger" ADD CONSTRAINT "house_ledger_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "game_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "house_ledger" ADD CONSTRAINT "house_ledger_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_tables" ADD CONSTRAINT "game_tables_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_table_id_fkey" FOREIGN KEY ("table_id") REFERENCES "game_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seats" ADD CONSTRAINT "seats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
