import _ from "lodash";
import plimit from "p-limit";
import { generate } from "random-words";
import chalk from "chalk";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { createInterface } from "readline";
import { HttpsProxyAgent } from "https-proxy-agent";
import { HttpProxyAgent } from "http-proxy-agent";
import axios from "axios";
import fs from "fs";
import path from "path";
import headers from "./headers.js";
import getRandomQuestion from "./questions.js";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const readline = createInterface({
  input: process.stdin,
  output: process.stdout,
});

// File path for storing total interactions
const logFilePath = path.join(__dirname, "total_interactions.json");

// Load previous total interactions
let totalInteractions = 0;
if (fs.existsSync(logFilePath)) {
  try {
    const savedData = JSON.parse(fs.readFileSync(logFilePath, "utf8"));
    totalInteractions = savedData.totalInteractions || 0;
  } catch (error) {
    console.log(chalk.red("⚠️ Error reading interaction log. Resetting counter."));
    totalInteractions = 0;
  }
}

let totalPoints = 0;

// Function to save the updated total interactions
const saveTotalInteractions = () => {
  fs.writeFileSync(logFilePath, JSON.stringify({ totalInteractions }, null, 2));
};

// Function to update dashboard stats (MAKE SURE WALLET IS PASSED)
const updateDashboard = async (wallet, totalInteractions, totalPoints, innerAxios) => {
  if (!wallet) {
    console.log(chalk.red("⚠️ Wallet address is missing. Skipping dashboard update."));
    return;
  }

  try {
    const response = await innerAxios.post("https://api.zettablock.com/update-stats", {
      wallet: wallet,
      total_interactions: totalInteractions,
      total_points: totalPoints,
    });

    console.log(chalk.green(`📤 Updating dashboard for wallet: ${wallet}`));
    console.log(chalk.blue(`📊 Total Interactions: ${totalInteractions} | Total Points: ${totalPoints}`));

    if (response.status === 200) {
      console.log(chalk.green("✅ Successfully updated dashboard!"));
    } else {
      console.log(chalk.red("⚠️ Failed to update dashboard. Check API response."));
    }
  } catch (error) {
    console.log(chalk.red("⚠️ Error updating dashboard:", error.message));
  }
};

function showBanner() {
  console.log(chalk.blue(`\n==========================================`));
  console.log(chalk.green(`=            Kite Ai Auto Bot            =`));
  console.log(chalk.yellow(`=               Batang Eds               =`));
  console.log(chalk.blue(`==========================================\n`));
}

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
    timeout: 15000 
  };
  if (proxyUrl) {
    const proxyAgent = new HttpsProxyAgent(proxyUrl);
    config.httpsAgent = proxyAgent;
    config.httpAgent = new HttpProxyAgent(proxyUrl);
  }
  return axios.create(config);
}

const sendMessage = async ({ item, wallet_address, innerAxios }) => {
  if (!wallet_address) {
    console.log(chalk.red("⚠️ Wallet address is missing! Skipping this request."));
    return;
  }

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
        response = await innerAxios.post(item.url, { message, stream: true, wallet: wallet_address });
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
      totalInteractions++;
      saveTotalInteractions();

      totalPoints += Math.floor(Math.random() * 10) + 1;

      console.log(chalk.green(`[${timestamp}] ✅ Message sent successfully`));
      console.log(chalk.yellow(`⏳ Request time: ${(endTime - startTime) / 1000}s`));
      console.log(chalk.blue(`📊 Total Interactions: ${totalInteractions} | Total Points Earned: ${totalPoints}`));

      // 🔄 Update the dashboard API with correct wallet
      await updateDashboard(wallet_address, totalInteractions, totalPoints, innerAxios);
    } else {
      console.log(chalk.red(`❌ Failed after ${maxAttempts} attempts. Moving to next message...`));
    }
  } catch (error) {
    console.error(chalk.red("⚠️ Error sending message:"), error);
  }
  await sleep(1000);
};

const main = async ({ wallet, innerAxios }) => {
  if (!wallet) {
    console.log(chalk.red("⚠️ No wallet address provided. Exiting."));
    process.exit(1);
  }

  console.log(chalk.green(`🚀 Running bot for wallet: ${wallet}`));

  while (true) {
    for (const item of agents) {
      await sendMessage({ item, wallet_address: wallet, innerAxios });
    }
  }
};

const index = async () => {
  showBanner();
  readline.question(chalk.yellow("🔑 Enter wallet address: "), async (wallet) => {
    if (!wallet) {
      console.log(chalk.red("⚠️ Wallet address is required!"));
      process.exit(1);
    }

    const proxy = null;
    const innerAxios = createAxiosInstance(proxy);
    await main({ wallet, innerAxios });
    readline.close();
  });
};

index();
