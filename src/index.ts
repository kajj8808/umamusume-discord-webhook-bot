import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { upsertPickupData, upsertRewords } from "../lib/auto";
import db from "../lib/db";
import { sendPickupDataToDiscord, sendPostToDiscord } from "../lib/discord";
import {
  formatToKorDate,
  getDaysBetween,
  getMondaysBetween,
} from "../lib/utile";
import { Field } from "../types/interface";
import schedule from "node-schedule";
import { umamusumeChannelScraper } from "../lib/scraper";

const app = new Hono();

app.get("/get/main-pickup", async (c) => {
  const mainPickups = await db.mainPickup.findMany();
  return c.json({
    ok: true,
    results: mainPickups,
  });
});

app.get("/get/rewords", async (c) => {
  const rewords = await db.reward.findMany();
  return c.json({
    ok: true,
    results: rewords,
  });
});

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

schedule.scheduleJob({ hour: 0, minute: 5 }, async () => {
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
    fields.push({
      name: `${mainPickup.description} [D-${betweenDays}]`,
      value: `쥬얼: ${freeJewel},무지개 조각: ${rainbowPiece},캐릭터 티켓: ${characterTicket},서포트 티켓: ${supportTicket}`,
    });
  }
  sendPickupDataToDiscord({
    title: `사료 계산기 ${formatToKorDate(new Date())}`,
    fields: fields,
  });
  // post 부분
  const posts = await umamusumeChannelScraper();

  for (let post of posts) {
    try {
      const newPost = await db.post.create({
        data: {
          title: post.title,
          description: post.description,
          image: post.image,
          link: post.link,
        },
      });
      sendPostToDiscord(newPost);
    } catch (error) {
      // title 를 유니크 값으로 중복일 경우 db에 등록하지 않습니다.
    }
  }
});
const posts = umamusumeChannelScraper();
