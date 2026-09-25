import { NextFunction, Request, Response } from "express";
import sendResponse from "../../../../utils/commonFunctions/sendResponse";
import { StatusCodes } from "http-status-codes";
import { messages } from "../../../../constants/messages";
import UserModel from "../../../../models/user.model";
import { IUser } from "../../../../types";
import { ProductService } from "../../../../services/products/product.service";
import { IProduct } from "../../../../types/products.types";
import { localizeProduct, localizeProducts } from "../../../../utils/i18n/localizeProduct";
import { resolveLanguage } from "../../../../utils/i18n/localizeFlowDefinition";
import { entitlementService } from "../../../../services/entitlements/entitlement.service";
import {
    applyProductEntitlements,
    isProductUnlocked,
    redactProduct,
} from "../../../../services/products/product-access.service";
import { ECapability } from "../../../../services/entitlements/entitlement.config";

export class ProductController {
    private productService: ProductService;
    constructor() {
        this.productService = new ProductService();
    }

    private productFilter(user: IUser) {
        return {
            // Array field; an equality match on a scalar still matches membership.
            userCategory: user.user_category,
            validWeekStart: { $lte: user.current_weekdays.weeks },
            validWeekEnd: { $gte: user.current_weekdays.weeks },
        };
    }

    public getProducts = async (request: Request, response: Response, next: NextFunction) => {
        if (!request.user) {
            throw new Error(messages.USER_FETCH_FAILED);
        }
        const user = (await UserModel.findById(request.user._id)) as IUser;
        try {
            const products: IProduct[] = await this.productService.find({
                filter: this.productFilter(user),
                // Without a stable sort the "first 2 unlocked" would shuffle between two
                // loads of the same screen, since natural order changes on rewrite.
                sort: { sortOrder: 1, _id: 1 },
            });

            const lang = resolveLanguage(request.query?.lang as string, user.preferred_language);
            // resolveFor, not resolveTier: the rule must carry any per-user override, or
            // a referral program that suppresses products would be ignored here.
            const { rule } = await entitlementService.resolveFor(
                user._id,
                ECapability.PRODUCTS_VIEW,
            );

            response.set({
                "Cache-Control": "no-store, no-cache, must-revalidate",
                Pragma: "no-cache",
                Expires: "0",
            });

            sendResponse({
                data: applyProductEntitlements(localizeProducts(products, lang), rule),
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

    /**
     * Re-checks the slice rather than trusting the client to only request unlocked
     * products — otherwise the affiliate link is one guessable id away.
     */
    getProductById = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const [product] = await this.productService.find({
                filter: { _id: request.params.id },
            });

            if (!product) {
                return sendResponse({
                    data: null,
                    statusCode: StatusCodes.NOT_FOUND,
                    success: false,
                    message: messages.PRODUCT_FETCH_FAILED,
                    response,
                });
            }

            const user = request.user
                ? ((await UserModel.findById(request.user._id)) as IUser)
                : null;
            const lang = resolveLanguage(request.query?.lang as string, user?.preferred_language);
            const localized = localizeProduct(product, lang);

            if (!user) {
                return sendResponse({
                    data: redactProduct(localized),
                    statusCode: StatusCodes.OK,
                    success: true,
                    message: messages.PRODUCT_FETCH_SUCCESS,
                    response,
                });
            }

            const { rule } = await entitlementService.resolveFor(
                user._id,
                ECapability.PRODUCTS_VIEW,
            );
            const visible = await this.productService.find({
                filter: this.productFilter(user),
                sort: { sortOrder: 1, _id: 1 },
            });

            const unlocked = isProductUnlocked(String(product._id), visible, rule);

            sendResponse({
                data: unlocked ? localized : redactProduct(localized),
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
