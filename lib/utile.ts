import csvParser from "csv-parser";
import fs from "fs";

export async function readCSVFile<T>(filePath: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const result: T[] = [];
    fs.createReadStream(filePath)
      .pipe(csvParser())
      .on("data", (data) => {
        result.push(data);
      })
      .on("end", () => {
        resolve(result);
      })
      .on("error", (error) => {
        reject(error);
      });
  });
}

// 24. 09. 09 등을 date로 변환해주는 함수입니다.
export function formatToDateTime(date: string) {
  const splitDate = date.split(". ");
  const year = splitDate[0].padStart(4, "20");
  const month = splitDate[1];
  const day = splitDate[2];
  return new Date(`${year}-${month}-${day}`);
}

export function getDaysBetween(date1: Date, date2: Date) {
  // getTime()을 사용해 두 날짜의 밀리초 차이를 계산
  let timeDiff: number = Math.abs(date1.getTime() - date2.getTime());
  // 밀리초를 일로 변환 (1일 = 24시간 * 60분 * 60초 * 1000밀리초)
  let dayDiff: number = Math.round(timeDiff / (1000 * 60 * 60 * 24));
  return dayDiff;
}

export function getMondaysBetween(startDate: Date, endDate: Date) {
  const date1 = startDate;
  const date2 = endDate;
  date1.setDate(date1.getDate() + 1);
  let mondayCount = 0;
  while (true) {
    if (date1 >= date2) {
      break;
    }

    if (date1.getDay() === 1) {
      mondayCount++;
    }
    date1.setDate(date1.getDate() + 1);
  }
  return mondayCount;
}

export function formatToKorDate(date: Date) {
  return date.toLocaleDateString("ko-KR");
}
