const { access, constants } = require("fs");
const { chromium } = require("playwright");

const url = "https://beatsaver.com/browse/rating/";

let downloadsInProgress = {};

(async () => {
  if (
    typeof process.argv[2] === "undefined" ||
    typeof process.argv[3] === "undefined"
  ) {
    throw new Error(
      "Missing arguments. Try `npm start <download-path> <number-of-maps>`"
    );
  }

  console.log(`Navigation to ${url}`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 250,
  });
  const page = await browser.newPage({ acceptDownloads: true });

  page.on("download", async (download) => {
    const fileName = `${process.argv[2]}/${download.suggestedFilename()}`;
    downloadsInProgress[fileName] = "downloading";
    await download.saveAs(fileName);
    access(fileName, constants.F_OK | constants.W_OK, (err) => {
      if (err) {
        downloadsInProgress[fileName] = "error";
      } else {
        downloadsInProgress[fileName] = "saved";
      }
    });
  });

  await page.goto(url);
  const label = "Show auto-generated Beatmaps";

  console.log(`Checking ${label}`);

  await page.click(`text=Show auto-generated Beatmaps`);

  for (let i = 2; i < parseInt(process.argv[3]) + 2; i++) {
    const downloadLinkSelector = `.container .beatmap-result:nth-child(${i}) > div:nth-child(2) > div:nth-child(2) > div:nth-child(2) > a:nth-child(3)`;
    await page.waitForSelector(downloadLinkSelector, { state: "attached" });
    const downloadLinkElementHandle = await page.$(downloadLinkSelector);
    downloadLinkElementHandle.scrollIntoViewIfNeeded();

    const beatmapResultElementHandle = await page.$(
      `.container .beatmap-result:nth-child(${i}) > div:nth-child(2) > div:nth-child(1) > div:nth-child(1) > h1:nth-child(1)`
    );
    console.log(`Downloading: ${await beatmapResultElementHandle.innerText()}`);

    await page.click(downloadLinkSelector);
  }

  console.log("Waiting 30s for downloads to finish...");

  let checks = 0;
  let intervalId;
  const promise = new Promise((resolve, reject) => {
    intervalId = setInterval(() => {
      const isInProgress = Object.values(downloadsInProgress).reduce(
        (acc, status) => {
          if (status === "downloading") {
            return true;
          } else {
            return false;
          }
        },
        true
      );
      if (isInProgress === false) {
        checks = checks + 1;
      } else {
        checks = 0;
      }
      if (checks === 30) {
        resolve(true);
      }
    }, 1000);
  });

  await promise;
  clearInterval(intervalId);
  await browser.close();
})();
