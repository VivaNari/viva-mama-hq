import { FilterQuery, Model } from "mongoose";

class BaseService<T> {
    protected model: Model<T>;

    constructor(model: Model<T>) {
        this.model = model;
    }

    create = async (payload: T): Promise<T> => {
        const instance = await new this.model(payload).save();
        return instance as T;
    };

    find = async ({ filter = {} }: { filter: FilterQuery<T> }): Promise<T[]> => {
        const instances: T[] = await this.model.find(filter);
        return instances;
    };
}

export default BaseService;
