import { API_BABY_ARRIVED, API_LABOUR_STARTED } from '../constants/endpoints';
import { DeliveryOutcomeEnum, DeliveryTypeEnum } from '../types/user.types';
import apiClientInterceptor from './apiClientInterceptor';

/** "My labour has started". */
export const recordLabourStarted = async (): Promise<void> => {
    await apiClientInterceptor().post(API_LABOUR_STARTED);
};

/** "My baby is here". `delivery_date` is "YYYY-MM-DD". */
export const recordBabyArrived = async (birth: {
    delivery_date: string;
    delivery_type: DeliveryTypeEnum;
    delivery_outcome: DeliveryOutcomeEnum;
}): Promise<void> => {
    await apiClientInterceptor().post(API_BABY_ARRIVED, birth);
};
