import fs from "fs";
import path from "path";
import mongoose from "mongoose";

const DATA_DIR = path.join(__dirname, "../../../../server_data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, "embedded_db.json");

interface DBStore {
  User: any[];
  PredictionHistory: any[];
  UploadedFile: any[];
  Log: any[];
  Analytics: any[];
}

class EmbeddedStoreManager {
  private store: DBStore;

  constructor() {
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, "utf-8");
        this.store = JSON.parse(raw);
      } catch (e) {
        this.store = this.getInitialStore();
      }
    } else {
      this.store = this.getInitialStore();
      this.saveToDisk();
    }
  }

  private getInitialStore(): DBStore {
    return {
      User: [],
      PredictionHistory: [],
      UploadedFile: [],
      Log: [],
      Analytics: []
    };
  }

  public saveToDisk(): void {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.store, null, 2), "utf-8");
    } catch (e) {
      // Ignore write errors
    }
  }

  public getCollection(name: string): any[] {
    if (!(this.store as any)[name]) {
      (this.store as any)[name] = [];
    }
    return (this.store as any)[name];
  }

  public attachHelpers(doc: any, name: string): any {
    if (!doc || typeof doc !== "object") return doc;
    const manager = this;
    doc.save = async function () {
      this.updatedAt = new Date();
      const col = manager.getCollection(name);
      const idx = col.findIndex((item: any) => String(item._id) === String(this._id) || String(item.id) === String(this.id));
      if (idx !== -1) {
        col[idx] = this;
      } else {
        col.push(this);
      }
      manager.saveToDisk();
      return this;
    };
    return doc;
  }

  public create(name: string, data: any): any {
    const col = this.getCollection(name);
    const id = new mongoose.Types.ObjectId().toString();
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

  public find(name: string, query: any = {}): any[] {
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

  public findOne(name: string, query: any = {}): any | null {
    const results = this.find(name, query);
    return results.length > 0 ? results[0] : null;
  }

  public findById(name: string, id: string): any | null {
    const col = this.getCollection(name);
    const item = col.find(i => String(i._id) === String(id) || String(i.id) === String(id)) || null;
    return item ? this.attachHelpers(item, name) : null;
  }

  public deleteOne(name: string, query: any): boolean {
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

export const embeddedStore = new EmbeddedStoreManager();
