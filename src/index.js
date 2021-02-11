const EventEmitter = require("events");

const debug = require("debug");
const printDebug = debug("persistent-request");

const axios = require("axios");
const adapter = require("./adapter");

class PersistentRequest extends EventEmitter {
  constructor(requestOptions, options = {}) {
    super();
    if (typeof requestOptions !== "object")
      throw new TypeError(
        "persistent request should recieve a request options object as first argument"
      );

    this.requestOptions = requestOptions;
    this.options = {
      waitBeforeReconnection: 0,
      reconnectOnClose: false,
      keepaliveTime: 0,
      debugOnData: false,
    };
    Object.assign(this.options, options);

    this.nRequests = 0;

    this.connecting = false;
    this.connected = false;
    this.reconnecting = false;

    this.destroyed = false;

    this.connect();
  }
  connect() {
    if (this.destroyed) return this.debug("destroyed, can't connect");
    if (this.connecting || this.connected) this.abort();

    this.nRequests++;

    this.connecting = true;
    this.debug("connecting");
    this.emit("connecting");

    const reqSource = axios.CancelToken.source();
    this._reqSource = reqSource;
    const cancelToken = this._reqSource.token;

    let req = axios
      .request({
        ...this.requestOptions,
        adapter,
        responseType: "stream",
        cancelToken,
      })
      .then((res) => {
        // handle success
        this.connected = true;
        this.connecting = false;
        this.reconnecting = false;
        this.debug("connected");
        this.emit("response", res);

        res.data.on("close", () => {
          if (reqSource === this._reqSource) {
            // no new connection created
            clearTimeout(this._keepaliveTimeout);
            this.connected = false;
            this.debug("connection closed");
            this.emit("close");
            if (!this.destroyed && this.options.reconnectOnClose)
              this.reconnect();
          } else {
            this.debug("previous connection closed");
          }
        });

        if (this.options.keepaliveTime > 0) {
          let timeout;
          const resetTimeout = () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
              if (!this.destroyed) {
                this.debug(
                  `no data received during the minimum interval (${this.options.keepaliveTime}ms)`
                );
                this.reconnect(0);
              }
            }, this.options.keepaliveTime * 2);
          };
          res.data.on("data", resetTimeout); // Shannon criteria (never exactly <keepaliveTime> ms between packets)
          res.data.once("close", () => {
            clearTimeout(timeout);
          });
          resetTimeout();
        }
        if (this.options.debugOnData) {
          res.data.on("data", (chunk) => {
            this.debug(`data: ${chunk.length}`);
          });
        }
      })
      .catch((err) => {
        // handle error
        this.connected = false;
        this.connecting = false;
        this.reconnecting = false;
        if (axios.isCancel(err)) {
          this.debug("request canceled");
        } else {
          this.debug(`request failed: ${err.message}`);
          this.emit("request:error", err);
          if (err.response) {
            // server responded but with an error so we should emit an error event
            this.emit("error", err);
          }
          if (!this.destroyed && this.reconnectOnError) this.reconnect();
        }
      });

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
    this.debug("aborting connection");
    // FIXME: need to test this
    if (this._reqSource) {
      this._reqSource.cancel("aborted");
      delete this._reqSource;
    }
    this.emit("abort");
  }
  debug(msg) {
    printDebug(`[${this.uri}] ${msg}`);
  }
  get uri() {
    let { baseURL, url, params: _params } = this.requestOptions;

    let uri = (baseURL || "") + url;
    if (_params) {
      const params = new URLSearchParams(
        Object.entries(_params).filter(
          ([key, val]) => !(val === null || typeof val === "undefined")
        )
      );
      const search = params.toString();
      if (search) uri += `?${search}`;
    }
    return uri;
  }
  static enableDebugging() {
    debug.enable("persistent-request");
  }
  static get debug() {
    return debug.enabled("persistent-request");
  }
}

module.exports = PersistentRequest;
