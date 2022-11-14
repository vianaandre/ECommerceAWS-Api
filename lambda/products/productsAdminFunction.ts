import { APIGatewayProxyEvent, Context, APIGatewayProxyResult } from 'aws-lambda'
import { DynamoDB, Lambda } from 'aws-sdk'
import { ProductEventType, IProductEvent } from '/opt/nodejs/productEventsLayer'
import { IProduct, ProductRepository } from '/opt/nodejs/productsLayer'
import * as AWSXRay from 'aws-xray-sdk'

AWSXRay.captureAWS(require('aws-sdk'))

const productsDdb = process.env.PRODUCTS_DDB!
const productEventsFunctionName = process.env.PRODUCT_EVENTS_FUNCTION_NAME!

const ddbClient = new DynamoDB.DocumentClient()
const lambdaClient = new Lambda()

const productRepository = new ProductRepository(
    ddbClient,
    productsDdb
)

async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const lambdaRequestId = context.awsRequestId
    const apiRequestId = event.requestContext.requestId

    console.log(`API Gateway RequestId: ${apiRequestId} - Lambda RequestId: ${lambdaRequestId}`)

    const method = event.httpMethod

    if (event.resource === '/products') {
        console.log('POST /products')

        const product = JSON.parse(event.body!) as IProduct

        const productCreated = await productRepository.createProduct(product)

        const response = await sendProductEvent(productCreated, ProductEventType.CREATED, 'a@mail.com', lambdaRequestId)

        console.log(response)

        return {
            statusCode: 201, 
            body: JSON.stringify(productCreated)
        }
    } else if (event.resource === '/products/{id}') {
        const productId = event.pathParameters!.id as string

        if (method === 'PUT') {
            console.log(`PUT /products/${productId}`)

            try {
                const product = JSON.parse(event.body!) as IProduct

                const productUpdated = await productRepository.updateProduct(productId, product)

                const response = await sendProductEvent(productUpdated, ProductEventType.UPDATED, 'v@mail.com', lambdaRequestId)

                console.log(response)

                return {
                    statusCode: 200,
                    body: JSON.stringify(productUpdated)
                }
            } catch (ConditionalCheckFailedException) {
                return {
                    statusCode: 404,
                    body: 'Product not found'
                }
            }
        } else if (method === 'DELETE') {
            console.log(`DELETE /products/${productId}`)

            try {
                const productDeleted = await productRepository.deleteProduct(productId)

                const response = await sendProductEvent(productDeleted, ProductEventType.DELETED, 'g@mail.com', lambdaRequestId)

                console.log(response)

                return {
                    statusCode: 200,
                    body: JSON.stringify(productDeleted)
                }

            } catch (err) {
                console.error((<Error>err).message)

                return {
                    statusCode: 404,
                    body: (<Error>err).message
                }
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

function sendProductEvent(product: IProduct, eventType: ProductEventType, email: string, lambdaRequestId: string) {
    const event: IProductEvent = {
        email: email,
        eventType: eventType,
        productCode: product.code,
        productId: product.id,
        productPrice: product.price,
        requestId: lambdaRequestId,
    }

    return lambdaClient.invoke({
        FunctionName: productEventsFunctionName,
        Payload: JSON.stringify(event),
        InvocationType: 'Event'
    }).promise()
}

export { handler } 