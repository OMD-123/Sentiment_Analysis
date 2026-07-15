"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MLService = void 0;
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";
class MLService {
    static async predictText(text) {
        const response = await axios_1.default.post(`${ML_SERVICE_URL}/predict/text`, { text });
        return response.data;
    }
    static async predictImage(filePath) {
        const form = new form_data_1.default();
        form.append("file", fs_1.default.createReadStream(filePath), path_1.default.basename(filePath));
        const response = await axios_1.default.post(`${ML_SERVICE_URL}/predict/image`, form, {
            headers: form.getHeaders()
        });
        return response.data;
    }
    static async predictAudio(filePath) {
        const form = new form_data_1.default();
        form.append("file", fs_1.default.createReadStream(filePath), path_1.default.basename(filePath));
        const response = await axios_1.default.post(`${ML_SERVICE_URL}/predict/audio`, form, {
            headers: form.getHeaders()
        });
        return response.data;
    }
    static async predictMultimodal(options) {
        const form = new form_data_1.default();
        if (options.text) {
            form.append("text", options.text);
        }
        if (options.imagePath && fs_1.default.existsSync(options.imagePath)) {
            form.append("image", fs_1.default.createReadStream(options.imagePath), path_1.default.basename(options.imagePath));
        }
        if (options.audioPath && fs_1.default.existsSync(options.audioPath)) {
            form.append("audio", fs_1.default.createReadStream(options.audioPath), path_1.default.basename(options.audioPath));
        }
        const response = await axios_1.default.post(`${ML_SERVICE_URL}/predict/multimodal`, form, {
            headers: form.getHeaders()
        });
        return response.data;
    }
    static async getModelInfo() {
        const response = await axios_1.default.get(`${ML_SERVICE_URL}/model/info`);
        return response.data;
    }
}
exports.MLService = MLService;
