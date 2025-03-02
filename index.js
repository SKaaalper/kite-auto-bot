import _ from "lodash";
import plimit from "p-limit";
import { generate } from "random-words";
import chalk from "chalk";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createInterface } from "readline";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { HttpProxyAgent } from "http-proxy-agent";
import axios from "axios";
import fs from "fs";
import headers from "./headers.js";
import getRandomQuestion from "./questions.js";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

function showBanner() {
  console.log(chalk.blue(`\n==========================================`));
  console.log(chalk.green(`=            Kite Ai Auto Bot            =`));
  console.log(chalk.red(`=                                        =`));
  console.log(chalk.yellow(`=               Batang Eds               =`));
  console.log(chalk.blue(`==========================================\n`));
}

const proxyConfig = {
  enabled: false,
  current: "direct",
  proxies: [],
};

const agents = [
  { url: "https://deployment-r89ftdnxa7jwwhyr97wq9lkg.stag-vxzy.zettablock.com/main", agent_id: "deployment_R89FtdnXa7jWWHyr97WQ9LKG" },
  { url: "https://deployment-fsegykivcls3m9nrpe9zguy9.stag-vxzy.zettablock.com/main", agent_id: "deployment_fseGykIvCLs3m9Nrpe9Zguy9" },
  { url: "https://deployment-xkerjnnbdtazr9e15x3y7fi8.stag-vxzy.zettablock.com/main", agent_id: "deployment_xkerJnNBdTaZr9E15X3Y7FI8" },
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getCurrentTimestamp() {
  return new Date().toLocaleString();
}

function createAxiosInstance(proxyUrl = null) {
  const config = { 
    headers: { "Content-Type": "application/json" },
    timeout: 15000 // 15s timeout to avoid hanging requests
  };
  if (proxyUrl) {
    const proxyAgent = new HttpsProxyAgent(proxyUrl);
    config.httpsAgent = proxyAgent;
    config.httpAgent = new HttpProxyAgent(proxyUrl);
  }
  return axios.create(config);
}

const sendMessage = async ({ item, wallet_address, innerAxios }) => {
  try {
    const message = getRandomQuestion() || generate({ maxLength: 6 });
    const timestamp = getCurrentTimestamp();
    console.log(chalk.cyan(`[${timestamp}] Sending message:`), message);

    const startTime = Date.now();
    let response;
    let attempts = 0;
    let maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        response = await innerAxios.post(item.url, { message, stream: true });
        if (response.status === 200) break;
      } catch (error) {
        if (error.response && [502, 504].includes(error.response.status)) {
          console.log(chalk.yellow(`⚠️ Received ${error.response.status} error. Retrying... (${attempts + 1}/${maxAttempts})`));
        } else if (error.code === 'ECONNABORTED') {
          console.log(chalk.yellow(`⚠️ Request timed out. Retrying... (${attempts + 1}/${maxAttempts})`));
        } else {
          throw error;
        }
        attempts++;
        await sleep(3000);
      }
    }

    const endTime = Date.now();

    if (response && response.status === 200) {
      console.log(chalk.green(`[${timestamp}] ✅ Message sent successfully`));
      console.log(chalk.yellow(`⏳ Request time: ${(endTime - startTime) / 1000}s`));
    } else {
      console.log(chalk.red(`❌ Failed after ${maxAttempts} attempts. Moving to next message...`));
    }
  } catch (error) {
    console.error(chalk.red("⚠️ Error sending message:"), error);
  }
  await sleep(1000); // Ensure a delay before the next message
};

const main = async ({ wallet, innerAxios }) => {
  const limit = plimit(1);
  while (true) { // Ensure continuous execution
    for (const item of agents) {
      await sendMessage({ item, wallet_address: wallet, innerAxios });
    }
  }
};

const index = async () => {
  showBanner();
  readline.question(chalk.yellow("🔑 Enter wallet address: "), async (wallet) => {
    const proxy = null;
    const innerAxios = createAxiosInstance(proxy);
    await main({ wallet, innerAxios });
    readline.close();
  });
};

index();
