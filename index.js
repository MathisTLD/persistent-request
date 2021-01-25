const axios = require("axios");
const EventEmitter = require("events");
const { PassThrough } = require("stream");

const debug = require("debug");
const printDebug = debug("persistent-request");

class PersistentRequest extends EventEmitter {
  constructor(requestOptions, options = {}) {
    super();
    if (typeof requestOptions !== "object")
      throw new Error(
        "persistent request should recieve a request options object as first argument"
      );

    this.requestOptions = requestOptions;
    this.options = {
      waitBeforeReconnection: 0,
      reconnectOnClose: false,
      keepaliveTime: 0,
    };
    Object.assign(this.options, options);

    this.nRequests = 0;

    this.connecting = false;
    this.connected = false;
    this.reconnecting = false;

    this.destroyed = false;

    this.data = new PassThrough();

    this._reqSource = axios.CancelToken.source();

    this.connect();

    // avoid uncaught error
    this.on("error", () => {});
  }
  connect() {
    if (this.destroyed) return this.debug("destroyed, can't connect");
    this.abort();

    this.nRequests++;
    this.reqError = null;

    this.connecting = true;
    this.debug("connecting");
    this.emit("connecting");

    let req = axios
      .request({ ...this.requestOptions, responseType: "stream" })
      .then((res) => {
        // handle success
        this.connected = true;
        this.connecting = false;
        this.reconnecting = false;
        this.debug("connected");
        this.emit("response", res);

        res.data.on("close", () => {
          clearTimeout(this._keepaliveTimeout);
          this.connected = false;
          this.debug("connection closed");
          this.emit("close");
          if (!this.destroyed) this.reconnect();
        });

        this.once("abort", () => {
          if (typeof res.data.destroy === "function") {
            this.debug("destroying incoming message");
            res.data.destroy();
          }
        });

        if (this.options.keepaliveTime > 0) {
          res.data.on("data", () => {
            clearTimeout(this._keepaliveTimeout);
            this._keepaliveTimeout = setTimeout(() => {
              if (!this.destroyed) {
                this.debug(
                  `no data received during the minimum interval (${this.options.keepaliveTime}ms)`
                );
                this.reconnect(0);
              }
            }, this.options.keepaliveTime);
          });
        }

        // TODO: res.data might not be a node stream so pipe should ne work as intended
        res.data.pipe(this.data, { end: !this.options.reconnectOnClose });
        // .on("data", (data) => {
        //   debug(`[${this.uri}] got data: ${data.length}`);
        //   this.emit("data", data);
        // });
      })
      .catch((err) => {
        // handle error
        this.connected = false;
        this.connecting = false;
        this.reconnecting = false;
        if (axios.isCancel(err)) {
          this.debug("request canceled");
        } else {
          this.debug(`request failed with error ${err.code}`);
          this.emit("error", err);
          this.reqError = err;
          if (!this.destroyed && this.reconnectOnError) this.reconnect();
        }
      });
    // .then(function () {
    //   // always executed
    // });

    this.req = req;
  }
  async reconnect(wait = -1) {
    if (this.destroyed) return this.debug("destroyed, can't reconnect");
    if (this.reconnecting) return this.debug("already trying to reconnect");
    this.reconnecting = true;

    wait = wait < 0 ? this.options.waitBeforeReconnection : wait;

    this.debug(`will reconnect (${wait}ms)`);
    this.emit("reconnecting");

    if (wait > 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, wait);
      });
    }
    if (this.destroyed)
      return this.debug(
        "destroyed before reconnection attempt, can't reconnect"
      );
    this.connect();
  }
  destroy() {
    // set this.destroyed so code in #connect can know it should not reconnect
    this.destroyed = true;
    this.abort();
    this.emit("destroy");

    this.debug("destroyed");
  }
  abort() {
    // FIXME: need to test this
    this.emit("abort");
    this._reqSource.cancel("aborted");
  }
  debug(msg) {
    printDebug(`[${this.uri}] ${msg}`);
  }
  get uri() {
    let { baseURL, url } = this.requestOptions;
    return (baseURL || "") + url;
  }
  static enableDebugging() {
    debug.enable("persistent-request");
  }
  static get debug() {
    return debug.enabled("persistent-request");
  }
}

module.exports = PersistentRequest;
