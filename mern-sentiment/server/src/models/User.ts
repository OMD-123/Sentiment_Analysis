import mongoose, { Schema, Document } from "mongoose";
import { createModelProxy } from "../config/modelProxy";

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  role: "user" | "admin";
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  role: { type: String, enum: ["user", "admin"], default: "user" },
  createdAt: { type: Date, default: Date.now }
});

const UserModel = mongoose.model<IUser>("User", UserSchema);
export default createModelProxy<IUser>("User", UserModel);
