const PersistentRequest = require("../src");

PersistentRequest.enableDebugging();

const server = require("./server");

describe("Keepalive Test", async function () {
  let req;

  before(async () => {
    await server.start();
    req = new PersistentRequest(
      {
        url: "http://localhost:8080/stream",
        timeout: 200,
      },
      {
        waitBeforeReconnection: 500,
        reconnectOnClose: true,
        keepaliveTime: 200,
      }
    );
  });
  after(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    req.destroy();
    await server.stop();
  });

  it("should connect first", function () {
    return new Promise((resolve, reject) => {
      this.timeout(1000);
      if (req.connected) resolve();
      else {
        req.on("response", resolve);
      }
    });
  });
  it("should detect server crashed", function () {
    return new Promise((resolve, reject) => {
      req.once("reconnecting", resolve);
      server.stop();
      this.timeout(2000);
    });
  });
  it("should reconnect when server restarts", function () {
    return new Promise((resolve, reject) => {
      this.timeout(3000);
      server.start({ stopDataTimeout: 500 }).then(() => {
        req.on("response", resolve);
      });
    });
  });
  it("should reconnect when not recieving data within minimal interval", function () {
    return new Promise((resolve, reject) => {
      this.timeout(2000);
      req.on("reconnecting", resolve);
    });
  });
});
