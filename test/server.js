const path = require("path");
const { Worker } = require("worker_threads");

const server = {
  error: null,
  status: null,
  worker: null,
};
module.exports = server;

server.start = async function startServer(options = {}) {
  await server.stop();
  const worker = new Worker(path.resolve(__dirname, "server-worker.js"), {
    workerData: { wait: 0, ...options },
  });
  server.worker = worker;
  await new Promise((resolve) => worker.once("message", resolve));
  server.status = "up";
};
server.stop = async function stopServer() {
  if (server.worker) {
    await server.worker.terminate();
    server.status = "down";
  }
};
server.ping = function ping() {
  return new Promise((resolve, reject) => {
    let dateStart = Date.now();
    let req = require("axios").request({
      url: "http://localhost:8080/ping",
      timeout: 200,
    });
    req
      .then(() => {
        server.error = null;
        resolve();
      })
      .catch((err) => {
        server.error = err;
        reject(err);
      });
  });
};
