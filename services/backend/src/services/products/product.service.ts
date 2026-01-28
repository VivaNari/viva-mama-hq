import productModel from "../../models/product.model";
import { IProduct } from "../../types/products.types";
import BaseService from "../base.service";

export class ProductService extends BaseService<IProduct> {
    constructor() {
        super(productModel);
    }
}
