import { FilterQuery, Model, Schema } from "mongoose";

type FindOptions<T> = {
    filter?: FilterQuery<T>;
    sort?: Record<string, 1 | -1>;
    populate?: string | string[];
    selectedKeys?: string[];
    limit?: number;
    _id?: string;
};
class BaseService<T> {
    protected model: Model<T>;

    constructor(model: Model<T>) {
        this.model = model;
    }

    create = async (payload: Partial<T>): Promise<T> => {
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
        console.log("filter", filter);
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

    findById = async ({ _id, populate, selectedKeys }: FindOptions<T>): Promise<T | null> => {
        let query = this.model.findById(_id);

        if (populate) {
            query = query.populate(populate);
        }

        if (selectedKeys) {
            query = query.select(selectedKeys);
        }

        return query.exec();
    };

    findOne = async ({
        filter = {},
        populate,
        selectedKeys,
    }: FindOptions<T>): Promise<T | null> => {
        let query = this.model.findOne(filter);

        if (populate) {
            query = query.populate(populate);
        }
        if (selectedKeys) {
            query = query.select(selectedKeys);
        }

        return query.exec();
    };

    findByIdAndUpdate = async ({
        _id,
        payload,
    }: {
        _id: string | Schema.Types.ObjectId;
        payload: Partial<T>;
    }) => {
        const result = await this.model.findByIdAndUpdate(_id, payload, { new: true });
        return result;
    };

    delete = async ({ filter = {} }: Partial<FindOptions<T>>) => {
        const result = await this.model.deleteOne(filter, { new: true });
        return result;
    };
}

export default BaseService;
