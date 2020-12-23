const path = require("path");
const { Worker } = require("worker_threads");

const PersistentRequest = require("../index");

const server = {
  error: null,
  status: null,
  worker: null,
};
async function startServer(options = {}) {
  const worker = new Worker(path.resolve(__dirname, "server.js"), {
    workerData: { wait: 0, ...options },
  });
  server.worker = worker;
  await new Promise((resolve) => worker.once("message", resolve));
  server.status = "up";
}
async function stopServer() {
  await server.worker.terminate();
  server.status = "down";
}

function ping() {
  return new Promise((resolve, reject) => {
    let dateStart = Date.now();
    let req = require("request")({
      url: "http://localhost:8080/ping",
      timeout: 200,
    });
    req
      .on("response", () => {
        server.error = null;
        resolve();
      })
      .on("error", (err) => {
        server.error = err;
        reject(err);
      });
  });
}

const wait = (t) => new Promise((resolve) => setTimeout(resolve, t));

async function test() {
  // process.env["DEBUG"] = "persistent-request";

  await startServer();

  let lastLineIsProgression = false;
  const log = (...args) => {
    lastLineIsProgression = false;
    console.log(...args);
  };
  const displayProgression = () => {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    if (lastLineIsProgression) {
      process.stdout.moveCursor(0, -1);
      process.stdout.clearLine();
    }
    process.stdout.write(
      `| server: ${server.status}${
        server.error ? `, error: ${server.error.code}` : ""
      } `
    );
    process.stdout.cursorTo(0);
    process.stdout.moveCursor(50);
    process.stdout.write(
      `| request: ${request.connected ? "" : "dis"}connected${
        request.reconnecting ? " reconnecting" : ""
      }, nb_conn: ${request.nRequests}, last data: ${
        request.lastDataTimestamp
          ? `${Date.now() - request.lastDataTimestamp}ms`
          : null
      }\n`
    );
    lastLineIsProgression = true;
  };
  setInterval(displayProgression, 200);

  const request = new PersistentRequest(
    {
      url: "http://localhost:8080/stream",
    },
    {
      ping,
      pingInterval: 1000,
      reconnectInterval: 1000,
      reconnectOnClose: true,
    }
  );
  request.on("data", () => (request.lastDataTimestamp = Date.now()));

  log("up/down test");
  log("- up");
  await wait(5000);
  await stopServer();
  log("- down");
  await wait(5000);
  log("");

  log("ping timeout test");
  log("- server responds immediatly");
  await startServer();
  await wait(2500);
  server.worker.postMessage({ type: "options", options: { wait: 250 } });
  log("- server responds after 250ms");
  await wait(5000);
  server.worker.postMessage({ type: "options", options: { wait: 0 } });
  log("- server responds immediatly");
  await wait(2500);
  log("");

  log("closing connection every 3s");
  await wait(2000);
  server.worker.postMessage({ type: "close-all" });
  await wait(3000);
  server.worker.postMessage({ type: "close-all" });
  await wait(3000);

  process.exit(0);
}
test();
