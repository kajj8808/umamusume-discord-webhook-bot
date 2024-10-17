import path from "path";
import { formatToDateTime, readCSVFile } from "./utile";
import { MainPickupCSV, RewardCSV } from "../types/interface";
import db from "./db";

const DATA_DIR = path.join(__dirname, "../data");

export async function upsertPickupData() {
  const mainPickupCsvPath = path.join(DATA_DIR, "240930_주요 픽업 날짜.csv");
  const rows = await readCSVFile<MainPickupCSV>(mainPickupCsvPath);
  for (let row of rows) {
    const koreaDate = formatToDateTime(row["한섭 날짜"]);
    const jpanDate = formatToDateTime(row["일섭 날짜"]);
    const description = row["내역"];
    await db.mainPickup.upsert({
      where: {
        description: description,
      },
      create: {
        korea_date: koreaDate,
        japan_date: jpanDate,
        description: row["내역"],
      },
      update: {
        korea_date: koreaDate,
        japan_date: jpanDate,
        description: row["내역"],
      },
    });
  }
  console.log("주요 픽업 날짜 업데이트됨😗👍");
}

export async function upsertRewords() {
  const rewardCsvPath = path.join(DATA_DIR, "240930_data.csv");
  const rows = await readCSVFile<RewardCSV>(rewardCsvPath);
  for (let row of rows) {
    if (row["이름"]) {
      await db.reward.upsert({
        where: {
          name: row["이름"],
        },
        create: {
          japan_date: formatToDateTime(row["일섭 날짜"]),
          korea_date: formatToDateTime(row["한섭 날짜"]),
          name: row["이름"],
          free_jewel:
            row["무료쥬얼"] !== ""
              ? Number(row["무료쥬얼"].replace(/,/g, ""))
              : null,
          character_ticket:
            row["캐릭티켓"] !== "" ? parseInt(row["캐릭티켓"]) : null,
          support_ticket:
            row["서폿티켓"] !== "" ? parseInt(row["서폿티켓"]) : null,
          rainbow_piece:
            row["무지개 조각"] !== "" ? parseInt(row["무지개 조각"]) : null,
        },
        update: {
          japan_date: formatToDateTime(row["일섭 날짜"]),
          korea_date: formatToDateTime(row["한섭 날짜"]),
          name: row["이름"],
          free_jewel:
            row["무료쥬얼"] !== ""
              ? Number(row["무료쥬얼"].replace(/,/g, ""))
              : null,
          character_ticket:
            row["캐릭티켓"] !== "" ? parseInt(row["캐릭티켓"]) : null,
          support_ticket:
            row["서폿티켓"] !== "" ? parseInt(row["서폿티켓"]) : null,
          rainbow_piece:
            row["무지개 조각"] !== "" ? parseInt(row["무지개 조각"]) : null,
        },
      });
    }
  }
  console.log("사료 날짜 업데이트됨😗👍");
}
