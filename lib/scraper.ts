import puppeteer from "puppeteer";
import path from "path";

const EXAMPLE_DIR = path.join(__dirname, "../example");

interface UmamusumePost {
  title: string;
  description: string;
  image: string;
}

export async function umamusumeChannelScraper() {
  const url = "https://pf.kakao.com/_DzxjIb/posts";
  // browser open a new blank page
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  // goto page url
  await page.goto(url);
  await page.waitForSelector(".wrap_archive_content");
  // page screen shot
  await page.screenshot({ path: path.join(EXAMPLE_DIR, "screenshot.png") });

  // search boxs
  const cards = await page.$$(".area_card");

  const posts: UmamusumePost[] = [];
  for (let card of cards) {
    try {
      const title = await card.$eval("strong", (element) => {
        return element.textContent;
      });
      const description = await card.$eval(".desc_card", (element) => {
        return element.textContent;
      });
      const backgroundImage = await card.$eval(".wrap_fit_thumb", (element) => {
        return window.getComputedStyle(element).backgroundImage;
      });
      posts.push({
        title: title!,
        description: description!,
        image: backgroundImage.match(/url\("(.*)"/)![1], // url( a ) 안의 a 값을 구하기 위해 사용.
      });
    } catch (error) {
      // umamusume 채널 정보에는 title, thumnail이 필수로 포함 되어 있음. 그렇기에 스킵! ( 아닌 경우 => 채널 정보거나, 새소식 201 등 post 정보가 아님! )
    }
  }

  // close brower
  await browser.close();

  return posts;
}
