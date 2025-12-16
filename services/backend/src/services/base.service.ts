import { FilterQuery, Model, Schema } from "mongoose";

type FindOptions<T> = {
    filter?: FilterQuery<T>;
    sort?: Record<string, 1 | -1>;
    populate?: string | string[];
    selectedKeys?: string[];
    limit?: number;
};
class BaseService<T> {
    protected model: Model<T>;

    constructor(model: Model<T>) {
        this.model = model;
    }

    create = async (payload: T): Promise<T> => {
        const instance = await new this.model(payload).save();
        return instance as T;
    };

    find = async ({
        filter = {},
        sort,
        limit,
        populate,
        selectedKeys,
    }: FindOptions<T>): Promise<T[]> => {
        let query = this.model.find(filter);

        if (sort) {
            query = query.sort(sort);
        }
        if (limit) {
            query = query.limit(limit);
        }

        if (populate) {
            query = query.populate(populate);
        }

        if (selectedKeys) {
            query = query.select(selectedKeys);
        }

        return query.exec();
    };
}

export default BaseService;
