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
                    validWeeks: { $in: [user.current_weekdays.weeks] },
                },
            });
            sendResponse({
                data: products,
                statusCode: StatusCodes.OK,
                success: true,
                message: messages.CONTENT_FETCH_SUCCESS,
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
                message: messages.CONTENT_SAVED_SUCCESS,
                response,
            });
        } catch (err) {
            next(err);
        }
    };
}
