import mongoose from "mongoose";
import { embeddedStore } from "./embeddedMongo";

export const isMongoOnline = (): boolean => {
  return mongoose.connection.readyState === 1;
};

export function createModelProxy<T>(modelName: string, mongooseModel: mongoose.Model<T>): any {
  const handler: ProxyHandler<any> = {
    construct(target, args) {
      if (isMongoOnline()) {
        return new target(...args);
      }
      const data = args[0] || {};
      const id = new mongoose.Types.ObjectId().toString();
      const now = new Date();
      const doc = {
        _id: id,
        id: id,
        ...data,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || now
      };
      return embeddedStore.attachHelpers(doc, modelName);
    },
    get(target, prop, receiver) {
      if (isMongoOnline()) {
        return Reflect.get(target, prop, receiver);
      }

      switch (prop) {
        case "findOne":
          return async (query: any) => {
            return embeddedStore.findOne(modelName, query);
          };
        case "findById":
          return (id: any) => {
            const doc = embeddedStore.findById(modelName, String(id));
            const selectWrapper = {
              select: async (fields: string) => {
                if (!doc) return null;
                const copy = { ...doc };
                if (fields.includes("-password")) delete copy.password;
                return copy;
              },
              then: (resolve: any, reject: any) => resolve(doc)
            };
            return selectWrapper;
          };
        case "find":
          return (query: any = {}) => {
            let results = [...embeddedStore.find(modelName, query)];
            const queryWrapper = {
              sort: (sortObj: any) => {
                if (sortObj.createdAt === -1 || sortObj.date === 1 || sortObj.date === -1) {
                  results.sort((a, b) => {
                    const da = new Date(a.createdAt || a.date).getTime();
                    const db = new Date(b.createdAt || b.date).getTime();
                    return sortObj.createdAt === -1 ? db - da : da - db;
                  });
                }
                return queryWrapper;
              },
              limit: (max: number) => {
                results = results.slice(0, max);
                return queryWrapper;
              },
              then: (resolve: any, reject: any) => resolve(results)
            };
            return queryWrapper;
          };
        case "create":
          return async (data: any) => {
            return embeddedStore.create(modelName, data);
          };
        case "countDocuments":
          return async (query: any = {}) => {
            return embeddedStore.find(modelName, query).length;
          };
        case "aggregate":
          return async (pipeline: any[]) => {
            const items = embeddedStore.getCollection(modelName);
            if (items.length === 0) return [];
            const sumConf = items.reduce((acc: number, cur: any) => acc + (cur.confidence || 0), 0);
            return [{ _id: null, avgConf: sumConf / items.length }];
          };
        case "findOneAndDelete":
          return async (query: any) => {
            const doc = embeddedStore.findOne(modelName, query);
            if (doc) {
              embeddedStore.deleteOne(modelName, query);
              return doc;
            }
            return null;
          };
        default:
          return Reflect.get(target, prop, receiver);
      }
    }
  };

  return new Proxy(mongooseModel, handler);
}
