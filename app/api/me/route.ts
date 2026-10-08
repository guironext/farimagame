import { connection } from "next/server";
import { currentUser, publicUser } from "@/lib/server/auth";
import { jsonError } from "@/lib/server/errors";
import {
  BET_HOUSE_SHARE,
  BET_MAX_FCFA,
  BET_MIN_FCFA,
  BET_WINNERS_SHARE,
  CORIS_PER_LION,
  DEPOSIT_MAX_FCFA,
  DEPOSIT_MIN_FCFA,
  FCFA_PER_LION,
  PRO_STAKE_LIONS,
  SIGNUP_BONUS_CORIS,
  STAKE_CORIS,
  WINNER_SHARE,
  WITHDRAW_MAX_FCFA,
  WITHDRAW_MIN_FCFA,
} from "@/lib/config";

export async function GET() {
  await connection();
  try {
    const u = await currentUser();
    return Response.json({
      user: u ? publicUser(u) : null,
      config: {
        CORIS_PER_LION,
        PRO_STAKE_LIONS,
        STAKE_CORIS,
        SIGNUP_BONUS_CORIS,
        WINNER_SHARE,
        FCFA_PER_LION,
        DEPOSIT_MIN_FCFA,
        DEPOSIT_MAX_FCFA,
        WITHDRAW_MIN_FCFA,
        WITHDRAW_MAX_FCFA,
        BET_MIN_FCFA,
        BET_MAX_FCFA,
        BET_WINNERS_SHARE,
        BET_HOUSE_SHARE,
      },
    });
  } catch (e) {
    return jsonError(e);
  }
}
