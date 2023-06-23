import { EventEmitter } from "events";

class GlobalEmitter extends EventEmitter {
    constructor() {
        super();
    }
}

export default new GlobalEmitter();