import { Router } from "express";
import authMiddleware from "../../../../middlewares/authorization.middleware";
import requestValidator from "../../../../middlewares/requestValidator.middleware";
import { ProductController } from "../../controllers/products/product.controller";
import createProductvalidator from "../../validators/products/product.validator";

const productRouter = Router();
const getProductController = new ProductController();

productRouter.get("/products", authMiddleware("header"), getProductController.getProducts);
productRouter.get("/products/:id", authMiddleware("header"), getProductController.getProductById);
productRouter.post(
    "/admin/products",
    requestValidator(createProductvalidator),
    authMiddleware("header"),
    getProductController.createProduct,
);

export default productRouter;
