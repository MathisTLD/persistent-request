const { parentPort, workerData } = require("worker_threads");

const options = {
  wait: 0,
  ...workerData,
};

const http = require("http");

const server = http.createServer((req, res) => {
  setTimeout(() => {
    if (req.url === "/ping") {
      res.writeHead(200);
      res.end();
    } else {
      res.writeHead(200);
      setInterval(() => {
        res.write("foo");
      }, 100);
    }
  }, options.wait);
});

const sockets = new Set();
server.setMaxListeners(0);
server.on("connection", (socket) => {
  sockets.add(socket);
  server.once("close", () => {
    sockets.delete(socket);
  });
});

function closeSockets() {
  for (const socket of sockets) {
    socket.destroy();
    sockets.delete(socket);
  }
}

parentPort.on("message", (msg) => {
  if (msg && msg.type) {
    const { type } = msg;
    if (type === "options") {
      Object.assign(options, msg.options);
    } else if (type === "close-all") {
      closeSockets();
    }
  }
});

server.listen(8080, () => {
  parentPort.postMessage("up");
});