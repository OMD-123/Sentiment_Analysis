"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddedStore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const mongoose_1 = __importDefault(require("mongoose"));
const DATA_DIR = path_1.default.join(__dirname, "../../../../server_data");
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_FILE = path_1.default.join(DATA_DIR, "embedded_db.json");
class EmbeddedStoreManager {
    store;
    constructor() {
        if (fs_1.default.existsSync(DB_FILE)) {
            try {
                const raw = fs_1.default.readFileSync(DB_FILE, "utf-8");
                this.store = JSON.parse(raw);
            }
            catch (e) {
                this.store = this.getInitialStore();
            }
        }
        else {
            this.store = this.getInitialStore();
            this.saveToDisk();
        }
    }
    getInitialStore() {
        return {
            User: [],
            PredictionHistory: [],
            UploadedFile: [],
            Log: [],
            Analytics: []
        };
    }
    saveToDisk() {
        try {
            fs_1.default.writeFileSync(DB_FILE, JSON.stringify(this.store, null, 2), "utf-8");
        }
        catch (e) {
            // Ignore write errors
        }
    }
    getCollection(name) {
        if (!this.store[name]) {
            this.store[name] = [];
        }
        return this.store[name];
    }
    attachHelpers(doc, name) {
        if (!doc || typeof doc !== "object")
            return doc;
        const manager = this;
        doc.save = async function () {
            this.updatedAt = new Date();
            const col = manager.getCollection(name);
            const idx = col.findIndex((item) => String(item._id) === String(this._id) || String(item.id) === String(this.id));
            if (idx !== -1) {
                col[idx] = this;
            }
            else {
                col.push(this);
            }
            manager.saveToDisk();
            return this;
        };
        return doc;
    }
    create(name, data) {
        const col = this.getCollection(name);
        const id = new mongoose_1.default.Types.ObjectId().toString();
        const now = new Date();
        const doc = {
            _id: id,
            id: id,
            ...data,
            createdAt: data.createdAt || now,
            updatedAt: data.updatedAt || now
        };
        const helperDoc = this.attachHelpers(doc, name);
        col.push(helperDoc);
        this.saveToDisk();
        return helperDoc;
    }
    find(name, query = {}) {
        const col = this.getCollection(name);
        return col.filter(item => {
            for (const key of Object.keys(query)) {
                if (query[key] !== undefined && item[key] !== query[key]) {
                    return false;
                }
            }
            return true;
        }).map(doc => this.attachHelpers(doc, name));
    }
    findOne(name, query = {}) {
        const results = this.find(name, query);
        return results.length > 0 ? results[0] : null;
    }
    findById(name, id) {
        const col = this.getCollection(name);
        const item = col.find(i => String(i._id) === String(id) || String(i.id) === String(id)) || null;
        return item ? this.attachHelpers(item, name) : null;
    }
    deleteOne(name, query) {
        const col = this.getCollection(name);
        const idx = col.findIndex(item => {
            for (const key of Object.keys(query)) {
                if (query[key] !== undefined && String(item[key]) !== String(query[key])) {
                    return false;
                }
            }
            return true;
        });
        if (idx !== -1) {
            col.splice(idx, 1);
            this.saveToDisk();
            return true;
        }
        return false;
    }
}
exports.embeddedStore = new EmbeddedStoreManager();
