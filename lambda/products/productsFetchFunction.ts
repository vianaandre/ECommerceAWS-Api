import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda'
import { ProductRepository } from '/opt/nodejs/productsLayer'
import { DynamoDB } from 'aws-sdk'
import * as AWSXRay from 'aws-xray-sdk'

AWSXRay.captureAWS(require('aws-sdk'))

const productsDdb = process.env.PRODUCTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()

const productRepository = new ProductRepository(
    ddbClient,
    productsDdb
)

async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    
    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId

    console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)

    if (event.resource === '/products') {
        console.log('GET /products')

        const products = await productRepository.getAllProducts()

        return {
            statusCode: 200,
            body: JSON.stringify(products)
        }
    } else if (event.resource === '/products/{id}') {
        const productId = event.pathParameters!.id as string
        console.log(`GET /products/${productId}`)

        try {
            const product = await productRepository.getByIdProduct(productId)

            return {
                statusCode: 200, 
                body: JSON.stringify(product)
            }
        } catch (err) {
            console.error((<Error>err).message)
            
            return {
                statusCode: 404,
                body: (<Error>err).message
            }
        }
    }

    return {
        statusCode: 400,
        body: JSON.stringify({
            message: 'Bad request'
        })
    }
}

export { handler }