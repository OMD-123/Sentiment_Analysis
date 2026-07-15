"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadDir = path_1.default.join(__dirname, "../../../uploads");
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path_1.default.extname(file.originalname)}`);
    }
});
const fileFilter = (req, file, cb) => {
    const allowedMimes = [
        "image/jpeg", "image/png", "image/webp", "image/gif",
        "audio/wav", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/flac", "audio/x-wav"
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp|gif|wav|mp3|ogg|flac)$/i)) {
        cb(null, true);
    }
    else {
        cb(new Error("Unsupported file format. Only standard images (JPG, PNG, WEBP) and audio (WAV, MP3, OGG, FLAC) are allowed."));
    }
};
exports.upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
    fileFilter: fileFilter
});
