const debug = require("debug")("persistent-request");

const request = require("request");
const EventEmitter = require("events");

class PersistentRequest extends EventEmitter {
  constructor(requestOptions, options = {}) {
    super();
    if (typeof requestOptions !== "object")
      throw new Error(
        "persistent request should recieve a request options object as first argument"
      );

    this.requestOptions = requestOptions;
    this.options = {
      ping: undefined,
      pingInterval: 1000,
      reconnectInterval: 1000,
      reconnectOnClose: false,
      ...options,
    };

    this.nRequests = 0;

    this.reconnecting = false;
    this.connected = false;

    this.connect();

    // avoid uncaught error
    this.on("error", () => {});
  }
  connect() {
    this.destroyReq();

    this.nRequests++;
    this.reqError = null;
    debug(`[${this.uri}] trying to connect`);

    let req = request(this.requestOptions)
      .on("request", () => {
        this.emit("request");
      })
      .on("response", (res) => {
        this.connected = true;
        this.reconnecting = false;
        this.emit("response", res);
        debug(`[${this.uri}] connected`);
      })
      .on("error", (err) => {
        this.connected = false;
        this.emit("error", err);
        debug(`[${this.uri}] request failed with error ${err.code}`);
        this.reqError = err;
        this.reconnect();
      })
      .on("close", () => {
        this.emit("close");
        this.connected = false;
        debug(`[${this.uri}] connection closed`);
        if (this.options.reconnectOnClose) this.reconnect();
      })
      .on("data", (data) => {
        debug(`[${this.uri}] got data: ${data.length}`);
        this.emit("data", data);
      });

    let { ping, pingInterval } = this.options;
    if (ping) {
      const doPingTest = async () => {
        try {
          debug(`[${this.uri}] verifying ping`);
          await ping();
        } catch (e) {
          this.reconnect();
        }
      };
      doPingTest();
      req.pingInterval = setInterval(doPingTest, pingInterval);
    }
    this.req = req;
  }
  reconnect() {
    if (this.reconnecting)
      return debug(`[${this.uri}] already trying to reconnect`);
    debug(`[${this.uri}] trying to reconnect`);
    this.reconnecting = true;
    // stop req's ping interval
    clearInterval(this.req.pingInterval);

    let retrying = false;
    const retry = () => {
      debug(`[${this.uri}] reconnecting`);
      retrying = true;
      this.emit("reconnect");

      // stop trying to reconnect
      this.destroyReconnection();

      this.connect();
    };
    const { ping, reconnectInterval } = this.options;

    if (ping) {
      clearInterval(this.reconnectInterval);
      this.reconnectInterval = setInterval(async () => {
        try {
          debug(`[${this.uri}] pre-reconnection ping`);
          await ping();
          if (!retrying) retry();
        } catch (e) {
          if (!retrying)
            debug(
              `[${this.uri}] can't connect, will retry in ${reconnectInterval}ms`
            );
        }
      }, reconnectInterval);
    } else {
      setTimeout(retry, reconnectInterval);
    }
  }
  destroy() {
    this.destroyReq();
    this.destroyReconnection();
  }
  destroyReq() {
    if (this.req) {
      let req = this.req;
      if (req.req) req.req.destroy();
      clearInterval(req.pingInterval);
      req.destroy();
    }
  }
  destroyReconnection() {
    clearInterval(this.reconnectInterval);
  }
  get uri() {
    let { baseURL, url, uri } = this.requestOptions;
    return (baseURL || "") + (url || uri);
  }
}

module.exports = PersistentRequest;
