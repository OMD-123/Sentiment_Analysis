"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMongoOnline = void 0;
exports.createModelProxy = createModelProxy;
const mongoose_1 = __importDefault(require("mongoose"));
const embeddedMongo_1 = require("./embeddedMongo");
const isMongoOnline = () => {
    return mongoose_1.default.connection.readyState === 1;
};
exports.isMongoOnline = isMongoOnline;
function createModelProxy(modelName, mongooseModel) {
    const handler = {
        construct(target, args) {
            if ((0, exports.isMongoOnline)()) {
                return new target(...args);
            }
            const data = args[0] || {};
            const id = new mongoose_1.default.Types.ObjectId().toString();
            const now = new Date();
            const doc = {
                _id: id,
                id: id,
                ...data,
                createdAt: data.createdAt || now,
                updatedAt: data.updatedAt || now
            };
            return embeddedMongo_1.embeddedStore.attachHelpers(doc, modelName);
        },
        get(target, prop, receiver) {
            if ((0, exports.isMongoOnline)()) {
                return Reflect.get(target, prop, receiver);
            }
            switch (prop) {
                case "findOne":
                    return async (query) => {
                        return embeddedMongo_1.embeddedStore.findOne(modelName, query);
                    };
                case "findById":
                    return (id) => {
                        const doc = embeddedMongo_1.embeddedStore.findById(modelName, String(id));
                        const selectWrapper = {
                            select: async (fields) => {
                                if (!doc)
                                    return null;
                                const copy = { ...doc };
                                if (fields.includes("-password"))
                                    delete copy.password;
                                return copy;
                            },
                            then: (resolve, reject) => resolve(doc)
                        };
                        return selectWrapper;
                    };
                case "find":
                    return (query = {}) => {
                        let results = [...embeddedMongo_1.embeddedStore.find(modelName, query)];
                        const queryWrapper = {
                            sort: (sortObj) => {
                                if (sortObj.createdAt === -1 || sortObj.date === 1 || sortObj.date === -1) {
                                    results.sort((a, b) => {
                                        const da = new Date(a.createdAt || a.date).getTime();
                                        const db = new Date(b.createdAt || b.date).getTime();
                                        return sortObj.createdAt === -1 ? db - da : da - db;
                                    });
                                }
                                return queryWrapper;
                            },
                            limit: (max) => {
                                results = results.slice(0, max);
                                return queryWrapper;
                            },
                            then: (resolve, reject) => resolve(results)
                        };
                        return queryWrapper;
                    };
                case "create":
                    return async (data) => {
                        return embeddedMongo_1.embeddedStore.create(modelName, data);
                    };
                case "countDocuments":
                    return async (query = {}) => {
                        return embeddedMongo_1.embeddedStore.find(modelName, query).length;
                    };
                case "aggregate":
                    return async (pipeline) => {
                        const items = embeddedMongo_1.embeddedStore.getCollection(modelName);
                        if (items.length === 0)
                            return [];
                        const sumConf = items.reduce((acc, cur) => acc + (cur.confidence || 0), 0);
                        return [{ _id: null, avgConf: sumConf / items.length }];
                    };
                case "findOneAndDelete":
                    return async (query) => {
                        const doc = embeddedMongo_1.embeddedStore.findOne(modelName, query);
                        if (doc) {
                            embeddedMongo_1.embeddedStore.deleteOne(modelName, query);
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
