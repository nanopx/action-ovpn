// src/index.ts
import * as core3 from "@actions/core";

// src/main.ts
import * as fs from "node:fs/promises";
import * as core from "@actions/core";
import { Tail } from "tail";
var { $ } = await import("execa");
var ovpnConfig = core.getInput("ovpnConfig");
var configFile = ".config.ovpn";
var logFile = ".openvpn.log";
var pidFile = ".openvpn.pid";
var TIMEOUT = 15 * 1e3;
async function run() {
  await Promise.all([
    fs.writeFile(configFile, ovpnConfig, "utf-8"),
    fs.writeFile(logFile, "", "utf-8")
  ]);
  const tail = new Tail(logFile);
  try {
    core.info("Connecting to VPN...");
    const { stdout } = await $`sudo openvpn --config ${configFile} --daemon --log ${logFile} --writepid ${pidFile}`;
    core.info(stdout);
  } catch (e) {
    if (e instanceof Error) {
      core.error(e.message);
    } else {
      core.error("Unknown error");
    }
    tail.unwatch();
    throw e;
  }
  return new Promise((resolve) => {
    const timerId = setTimeout(() => {
      core.setFailed("VPN connection timed out.");
      tail.unwatch();
      throw new Error("VPN connection timed out.");
    }, TIMEOUT);
    tail.on("line", async (data) => {
      core.info(data);
      if (data.includes("Initialization Sequence Completed")) {
        tail.unwatch();
        clearTimeout(timerId);
        const pid = (await fs.readFile(pidFile, "utf-8")).trim();
        core.info(`VPN connection established. PID: ${pid}`);
        resolve(pid);
      }
    });
  });
}

// src/post.ts
import * as core2 from "@actions/core";
var { $: $2 } = await import("execa");
async function run2(pid) {
  if (!pid) {
    core2.warning("Could not find process");
    return;
  }
  core2.info("Cleaning up VPN connection...");
  try {
    await $2`sudo kill ${pid} || true`;
    core2.info("Done.");
  } catch (e) {
    if (e instanceof Error) {
      core2.warning(e.message);
    }
  }
}

// src/index.ts
var isPost = core3.getState("isPost");
async function run3() {
  if (!isPost) {
    core3.saveState("isPost", "true");
    try {
      const pid = await run();
      core3.saveState("pid", pid);
    } catch (e) {
      if (e instanceof Error) {
        core3.setFailed(e.message);
      }
    }
  } else {
    try {
      const pid = core3.getState("pid");
      await run2(pid);
    } catch (e) {
      if (e instanceof Error) {
        core3.setFailed(e.message);
      }
    }
  }
}
run3();
