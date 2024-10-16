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
