import { NextFunction, Request, Response } from "express";
import { ContentService } from "../../../../services/contents/content.service";
import { IContent } from "../../../../types/content.types";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import UserModel from "../../../../models/user.model";
import { IUser } from "../../../../types";
import { ProductService } from "../../../../services/products/product.service";
import { IProduct } from "../../../../types/products.types";

export class ProductController {
    private productService: ProductService = new ProductService();
    constructor() {
        this.productService = new ProductService();
    }

    public getProducts = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        const user = (await UserModel.findById(request.user._id)) as IUser;
        try {
            const products: IProduct[] = await this.productService.find({
                filter: {
                    userCategory: user.user_category,
                    validWeekStart: { $lte: user.current_weekdays.weeks },
                    validWeekEnd: { $gte: user.current_weekdays.weeks },
                },
            });
            response.set({
                "Cache-Control": "no-store, no-cache, must-revalidate",
                Pragma: "no-cache",
                Expires: "0",
            });
            sendResponse({
                data: products,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.PRODUCT_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    createProduct = async (request: Request, response: Response, next: NextFunction) => {
        try {
            if (!request.user) {
                throw new Error(messages.USER_FETCH_FAILED);
            }

            const instance: IProduct = await this.productService.create(request.body);
            sendResponse({
                data: instance,
                statusCode: StatusCodes.CREATED,
                success: true,
                message: messages.PRODUCT_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };

    getProductById = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const content = await this.productService.find({ filter: { _id: request.params.id } });
            sendResponse({
                data: content,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.PRODUCT_FETCH_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
