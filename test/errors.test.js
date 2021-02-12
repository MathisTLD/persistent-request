const PersistentRequest = require("../lib");

PersistentRequest.enableDebugging();

const server = require("./server");

describe("Errors", async function () {
  before(async () => {
    await server.start();
  });
  after(async () => {
    await server.stop();
  });

  it("should emit error event", function () {
    return new Promise((resolve, reject) => {
      this.timeout(1000);
      req = new PersistentRequest({
        baseURL: server.url,
        url: "/error",
      });

      req.on("error", resolve);
    });
  });
  it("should not emit error event", function () {
    return new Promise((resolve, reject) => {
      this.timeout(3000);
      req = new PersistentRequest({
        baseURL: server.url,
        url: "/stream",
      });

      setTimeout(
        () =>
          server.stop().then(() => {
            setTimeout(() => server.start().then(resolve), 1000);
          }),
        500
      );

      req.on("error", reject);
    });
  });
});
