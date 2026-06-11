import mongoose from "mongoose";
import { IProduct } from "../types/products.types";
import { productSchema } from "./schema/product.schema";

const productModel = mongoose.model<IProduct>("products", productSchema);

export default productModel;
