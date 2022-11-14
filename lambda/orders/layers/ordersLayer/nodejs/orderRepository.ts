import { DocumentClient } from 'aws-sdk/clients/dynamodb'

export interface IOrderProduct {
    code: string;
    price: number;
}

export interface IOrder {
    pk: string;
    sk: string;
    createdAt: number;
    shipping: {
        type: 'URGENT' | 'ECONOMIC';
        carrier: 'CORREIOS' | 'FEDEX';
    };
    billing: {
        totalPrice: number;
        payment: 'CASH' | 'CREDIT_CART' | 'DEBIT_CART';
    };
    products: IOrderProduct[];
}

class OrderRespository {
    private ddbClient: DocumentClient
    private ordersDdb: string

    constructor(ddClient: DocumentClient, ordersDdb: string) {
        this.ddbClient = ddClient
        this.ordersDdb = ordersDdb
    }

    async createOrder(order: IOrder): Promise<IOrder> {
        await this.ddbClient.put({
            TableName: this.ordersDdb,
            Item: order
        }).promise()

        return order
    }

    async getAllOrder(): Promise<IOrder[]> {
        const data = await this.ddbClient.scan({
            TableName: this.ordersDdb
        }).promise()

        return data.Items as IOrder[]
    }

    async getByEmailOrders(email: string): Promise<IOrder[]> {
        const data = await this.ddbClient.query({
            TableName: this.ordersDdb,
            KeyConditionExpression: 'pk = :email',
            ExpressionAttributeValues: {
                ':email': email
            }
        }).promise()

        return data.Items as IOrder[]
    }

    async getOrder(email: string, orderId: string): Promise<IOrder> {
        const data = await this.ddbClient.get({
            TableName: this.ordersDdb,
            Key: {
                pk: email, 
                sk: orderId
            }
        }).promise()
        
        if (data.Item) {
            return data.Item as IOrder
        } else {
            throw new Error('Order not found.')
        }
    }

    async deleteOrder(email: string, orderId: string): Promise<IOrder> {
        const data = await this.ddbClient.delete({
            TableName: this.ordersDdb,
            Key: {
                pk: email,
                sk: orderId
            },
            ReturnValues: 'ALL_OLD'
        }).promise()

        if (data.Attributes) {
            return data.Attributes as IOrder
        } else {
            throw new Error('Order not found.')
        }
    }
}

export { OrderRespository }