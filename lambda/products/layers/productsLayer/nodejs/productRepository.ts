import { DocumentClient } from 'aws-sdk/clients/dynamodb'
import { v4 as uuid } from 'uuid'

export interface IProduct {
    id: string;
    productName: string;
    code: string;
    price: number;
    model: string;
    productUrl: string;
}

class ProductRepository {
    private ddbClient: DocumentClient
    private productsDdb: string
    
    constructor(ddbClient: DocumentClient, productsDdb: string) {
        this.ddbClient = ddbClient
        this.productsDdb = productsDdb
    }

    async getAllProducts(): Promise<IProduct[]> {
        const data = await this.ddbClient.scan({
            TableName: this.productsDdb
        }).promise()

        return data.Items as IProduct[]
    }

    async getByIdProduct(productId: string): Promise<IProduct> {
        const data = await this.ddbClient.get({
            TableName: this.productsDdb,
            Key: {
                id: productId
            }
        }).promise()

        if (data.Item) {
            return data.Item as IProduct
        } else {
            throw new Error('Product not found')
        }
    }

    async getByIdsProducts(productIds: string[]): Promise<IProduct[]> {
        const keys: { id: string; }[] = []        
        productIds.forEach((productId) => keys.push({
            id: productId
        }))
        const data = await this.ddbClient.batchGet({
            RequestItems: {
                [this.productsDdb]: {
                    Keys: keys
                }
            }
        }).promise()

        return data.Responses![this.productsDdb] as IProduct[]
    }

    async createProduct(product: IProduct): Promise<IProduct> {
        product.id = uuid()

        await this.ddbClient.put({
            TableName: this.productsDdb,
            Item: product
        }).promise()

        return product
    }

    async deleteProduct(productId: string): Promise<IProduct> {
        const data = await this.ddbClient.delete({
            TableName: this.productsDdb,
            Key: {
                id: productId
            },
            ReturnValues: 'ALL_OLD'
        }).promise()

        if (data.Attributes) {
            return data.Attributes as IProduct
        } else {
            throw new Error('Not not found')
        }
    }

    async updateProduct(productId: string, product: IProduct): Promise<IProduct> {
        const data = await this.ddbClient.update({
            TableName: this.productsDdb,
            Key: {
                id: productId
            },
            ConditionExpression: 'attribute_exists(id)',
            ReturnValues: 'UPDATED_NEW',
            UpdateExpression: 'set productName = :n, code = :c, price = :p, model = :m, productUrl = :u',
            ExpressionAttributeValues: {
                ':n': product.productName,
                ':c': product.code,
                ':p': product.price,
                ':m': product.model,
                ':u': product.productUrl
            }
        }).promise()

        data.Attributes!.id = productId

        return data.Attributes as IProduct
    }
}

export { ProductRepository }