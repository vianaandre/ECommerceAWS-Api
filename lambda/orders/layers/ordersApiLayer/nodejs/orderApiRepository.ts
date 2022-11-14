export enum IPayment {
    CASH = 'CASH',
    BEBIT_CARD = 'BEBIT_CARD',
    CREDIT_CART = 'CREDIT_CART' 
}

export enum IShipping {
    ECONOMIC = 'ECONOMIC',
    URGENT = 'URGENT'
}

export enum ICarrier {
    CORREIOS = 'CORREIOS',
    FEDEX = 'FEDEX'
}

export interface IOrderRequest {
    email: string;
    productsId: string[];
    payment: 'CASH' | 'CREDIT_CART' | 'DEBIT_CART';
    shipping: {
        type: IShipping;
        carrier: ICarrier
    }
}

export interface IOrderProduct {
    code: string;
    price: number;
}

export interface IOrderResponse {
    email: string;
    id: string;
    createdAt: number;
    billing: {
        payment: IPayment;
        totalPrice: number;
    };
    shipping: {
        type: IShipping;
        carrier: ICarrier;
    };
    products: IOrderProduct[]
}