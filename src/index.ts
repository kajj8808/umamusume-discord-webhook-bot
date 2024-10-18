/* import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
 */

import { upsertPickupData, upsertRewords } from "../lib/auto";
import db from "../lib/db";
import { sendPickupDataToDiscord } from "../lib/discord";
import {
  formatToKorDate,
  getDaysBetween,
  getMondaysBetween,
} from "../lib/utile";
import { Field } from "../types/interface";
import schedule from "node-schedule";

const jab = schedule.scheduleJob({ hour: 16, minute: 9 }, async () => {
  await upsertPickupData();
  await upsertRewords();

  const startDate = new Date();
  const endDate = new Date();
  endDate.setMonth(startDate.getMonth() + 3);

  const mainPickups = await db.mainPickup.findMany({
    where: {
      korea_date: {
        gte: startDate,
        lte: endDate,
      },
    },
  });

  const fields: Field[] = [];

  for (let mainPickup of mainPickups) {
    let freeJewel = 0;
    let characterTicket = 0;
    let supportTicket = 0;
    let rainbowPiece = 0;

    const nowDate = new Date();
    const koreaDate = new Date(mainPickup.korea_date);

    const rewords = await db.reward.findMany({
      where: {
        korea_date: {
          gte: nowDate,
          lte: koreaDate,
        },
      },
    });
    for (let reword of rewords) {
      if (reword.free_jewel) {
        freeJewel += reword.free_jewel;
      }
      if (reword.rainbow_piece) {
        rainbowPiece += reword.rainbow_piece;
      }
      if (reword.support_ticket) {
        supportTicket += reword.support_ticket;
      }
      if (reword.character_ticket) {
        characterTicket += reword.character_ticket;
      }
    }
    const monthGap = Math.floor(koreaDate.getMonth() - nowDate.getMonth());
    const circle = 2100;
    const dayMission = 50;
    const jewelPack = 50;
    const teamRace = 150;
    const loginBouse = 110 / 7;
    const betweenDays = getDaysBetween(koreaDate, nowDate);
    const mondays = getMondaysBetween(nowDate, koreaDate);

    freeJewel += Math.floor(loginBouse * betweenDays);
    freeJewel += dayMission * betweenDays;
    freeJewel += jewelPack * betweenDays;
    freeJewel += mondays * teamRace;
    freeJewel += monthGap * circle;
    console.log(mainPickup.description, freeJewel);
    fields.push({
      name: mainPickup.description,
      value: `쥬얼: ${freeJewel},무지개 조각: ${rainbowPiece},캐릭터 티켓: ${characterTicket},서포트 티켓: ${supportTicket}`,
    });
  }
  sendPickupDataToDiscord({
    title: `사료 계산기 ${formatToKorDate(new Date())}`,
    fields: fields,
  });
});
