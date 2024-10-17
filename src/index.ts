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

function getDaysBetween(date1: Date, date2: Date) {
  // getTime()을 사용해 두 날짜의 밀리초 차이를 계산
  let timeDiff: number = Math.abs(date1.getTime() - date2.getTime());
  // 밀리초를 일로 변환 (1일 = 24시간 * 60분 * 60초 * 1000밀리초)
  let dayDiff: number = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  return dayDiff;
}

function getMondaysBetween(date1: Date, date2: Date) {
  const startDate = date1;
  const endDate = date2;
  startDate.setDate(startDate.getDate() + 1);
  let mondayCount = 0;
  while (true) {
    if (startDate >= endDate) {
      break;
    }

    if (startDate.getDay() === 1) {
      mondayCount++;
    }
    startDate.setDate(startDate.getDate() + 1);
  }
  return mondayCount;
}

import { upsertPickupData, upsertRewords } from "../lib/auto";
import db from "../lib/db";

(async () => {
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

  let characterTicket = 0;
  let supportTicket = 0;
  let rainbowPiece = 0;

  for (let mainPickup of mainPickups) {
    let freeJewel = 0;
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

    // console.log(betweenDays);
    console.log(mainPickup.description, freeJewel);
  }
})();
