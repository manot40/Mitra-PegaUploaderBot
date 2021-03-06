import cliProgress from "cli-progress";
import Puppeteer from "puppeteer";
import colors from "colors";
import store from "./store";

async function startBrowser(config) {
  const browser = await Puppeteer.launch({ headless: config.silent });
  const page = await browser.newPage();
  const timeout = config.timeout * 1000;
  page.setViewport({ width: 1366, height: 768 });
  page.setDefaultTimeout(timeout);
  await page.goto(config.url);
  return { browser, page };
}

const progress = new cliProgress.SingleBar({
  format: "Uploading |" + colors.grey("{bar}") + "| {percentage}% |",
  barCompleteChar: "\u2588",
  barIncompleteChar: "\u2591",
  hideCursor: true,
});

export default async (config) => {
  const { page } = await startBrowser(config);
  const temp = `./${config.folder}/.temp/`;
  let frame, node;
  return {
    async setNode(i) {
      node = i;
    },
    async reloadPage() {
      await page.reload({ waitUntil: "networkidle0" });
    },
    async sleep(timeout) {
      await page.waitForTimeout(timeout);
    },
    async login() {
      try {
        await page.click("#txtUserID");
        await page.click("#txtUserID");
        await page.keyboard.type(store.getUsername());
        await page.click("#txtPassword");
        await page.keyboard.type(store.getPassword());
        await page.click("#sub");
        await page.waitForTimeout("1500");
        try {
          await page.waitForSelector("#errorDiv", { timeout: 500 });
          console.log("\x1b[31m", "Incorrect Password/Username");
          console.log("\x1b[37m", "Please Retry");
          process.exit(0);
        } catch (err) {
          await page.waitForSelector('li[title="Pengajuan"]');
        }
      } catch (err) {
        console.error(err.message);
        await this.reloadPage();
        this.login();
      }
    },
    async beginInput() {
      try {
        progress.start(100, 0);
        await page.waitForSelector('li[title="Pengajuan"]');
        await page.click('li[title="Pengajuan"]');
        await page.waitForTimeout(100);
        await page.mouse.click(330, 50);
        await page.waitForTimeout("1500");
        progress.update(20);
      } catch (err) {
        console.error(err.message);
        await this.reloadPage();
        this.beginInput();
      }
    },
    async createForm() {
      try {
        await page.waitForSelector(`[id="PegaGadget${node}Ifr"]`);
        const elementHandle = await page.$(`iframe[id="PegaGadget${node}Ifr"]`);
        frame = await elementHandle.contentFrame();
        await frame.waitForSelector('[id="7fe8a912"]');
        await frame.select('[id="7fe8a912"]', store.getJob(0));
        await page.waitForTimeout(100);
        await frame.click('[title="Complete this assignment"]');
        progress.update(40);
      } catch (err) {
        console.error(err.message);
        await this.reloadPage();
        this.createForm();
      }
    },
    async handleForm(file) {
      try {
        await frame.waitForSelector('input[id="2bc4e467"]');
        await frame.click('input[id="2bc4e467"]');
        config.customDesc.includes(store.getJob(0))
          ? await page.keyboard.type(file.slice(0, -4))
          : await page.keyboard.type(store.getJob(1));
        progress.update(50);
      } catch (err) {
        console.error(err.message);
        await this.reloadPage();
        this.handleForm();
      }
    },
    async uploadFile(file) {
      try {
        await frame.waitForSelector(
          'input[name="$PpyWorkPage$pFileSupport$ppxResults$l1$ppyLabel"]'
        );
        progress.update(60);
        const uploadHandler = await frame.$(
          'input[name="$PpyWorkPage$pFileSupport$ppxResults$l1$ppyLabel"]'
        );
        progress.update(70);
        await uploadHandler.uploadFile(temp + file);
        await frame
          .waitForSelector('div[node_name="pyCaseRelatedContentInner"]')
          .catch(async () => {
            await frame
              .waitForSelector('div[id="pega_ui_mask"]', { hidden: true })
              .catch();
          });
        await page.waitForTimeout(1000);
        progress.update(90);
        await frame.click('[title="Complete this assignment"]');
      } catch (err) {
        console.error(err.message);
        await this.reloadPage();
        this.uploadFile();
      }
    },
    async finishing() {
      try {
        await frame
          .waitForSelector('[node_name="pyConfirmMessage"]')
          .catch(async () => {
            await frame.click('[title="Complete this assignment"]').catch();
            await page.waitForTimeout(3000);
            await frame.waitForSelector('[node_name="pyConfirmMessage"]');
          });
        await page.waitForTimeout(1000);
        progress.update(100);
        progress.stop();
        //
      } catch (err) {
        console.error(err.message);
        await this.reloadPage();
        this.finishing();
      }
    },
  };
};
