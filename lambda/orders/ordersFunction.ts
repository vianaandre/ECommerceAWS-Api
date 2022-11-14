import { DynamoDB, SNS } from "aws-sdk"
import { IOrder, IOrderProduct, OrderRespository } from "/opt/nodejs/ordersLayer"
import { IProduct, ProductRepository } from "/opt/nodejs/productsLayer"
import * as AWSXRay from 'aws-xray-sdk'
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda"
import { ICarrier, IOrderRequest, IOrderResponse, IPayment, IShipping } from "/opt/nodejs/ordersApiLayer"
import { Envelope, IOrderEvent, OrderEventType } from '/opt/nodejs/orderEventsLayer'
import { v4 as uuid } from 'uuid'

AWSXRay.captureAWS(require('aws-sdk'))

const ordersDdb = process.env.ORDERS_DDB!
const productsDdb = process.env.PRODUCTS_DDB!
const orderEventsTopicArn = process.env.ORDER_EVENTS_TOPIC_ARN!

const ddbClient = new DynamoDB.DocumentClient()
const snsClient = new SNS()

const orderRepository = new OrderRespository(ddbClient, ordersDdb)
const productRepository = new ProductRepository(ddbClient, productsDdb)

async function handler(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {

    const method = event.httpMethod
    const apiRequestId = event.requestContext.requestId
    const lambdaRequestId = context.awsRequestId

    console.log(`API Gateway RequestId: ${apiRequestId} - LambdaRequestId: ${lambdaRequestId}`)

    if (method === 'GET') {
        if (event.queryStringParameters) {
            const email = event.queryStringParameters!.email
            const orderId = event.queryStringParameters!.orderId

            if (email) {
                if (orderId) {
                    try {
                        const order = await orderRepository.getOrder(email, orderId)
                    
                        return {
                            statusCode: 200,
                            body: JSON.stringify(convertToOrderResponse(order))
                        }
                    } catch(err) {
                        console.log((<Error>err).message)

                        return {
                            statusCode: 404,
                            body: (<Error>err).message
                        }
                    }
                } else {
                    const orders = await orderRepository.getByEmailOrders(email)

                    return {
                        statusCode: 200,
                        body: JSON.stringify(orders.map(convertToOrderResponse))
                    }
                }
            }
        } else {
            const orders = await orderRepository.getAllOrder()

            return {
                statusCode: 200,
                body: JSON.stringify(orders.map(convertToOrderResponse))
            }
        }
    } else if (method === 'POST') {
        console.log('POST /orders')

        const orderRequest = JSON.parse(event.body!) as IOrderRequest
        const products = await productRepository.getByIdsProducts(orderRequest.productsId)

        if(products.length === orderRequest.productsId.length) {
            const order = buildOrder(orderRequest, products)
            const orderCreatedPromise = orderRepository.createOrder(order)
            const eventResultPromise = sendOrderEvent(order, OrderEventType.CREATED, lambdaRequestId)

            const results = await Promise.all([
                orderCreatedPromise,
                eventResultPromise
            ])
            
            console.log(`Order created event send - OrderId: ${order.sk} - MessageId: ${results[1].MessageId}`)

            return {
                statusCode: 201,
                body: JSON.stringify(convertToOrderResponse(order))
            }
        } else {
            return {
                statusCode: 404,
                body: JSON.stringify({
                    message: 'Some product was not found'
                })
            }
        }
    } else if (method === 'DELETE') {
        console.log('DELETE /orders')
        const email = event.queryStringParameters!.email!
        const orderId = event.queryStringParameters!.orderId!

        try {
            const orderDeleted = await orderRepository.deleteOrder(email, orderId)

            const eventResult = await sendOrderEvent(orderDeleted, OrderEventType.DELETED, lambdaRequestId)
            console.log(`Order deleted event send - OrderId: ${orderDeleted.sk} - MessageId: ${eventResult.MessageId}`)

            return {
                statusCode: 200,
                body: JSON.stringify(convertToOrderResponse(orderDeleted))
            }
        } catch (err) {
            console.log((<Error>err).message)

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

function sendOrderEvent(order: IOrder, eventType: OrderEventType, lambdaRequestId: string) {
    const productCodes: string[] = []
    order.products.forEach((product) => {
        productCodes.push(product.code)
    })
    
    const orderEvent: IOrderEvent = {
        email: order.pk,
        orderId: order.sk!,
        billing: order.billing,
        shipping: order.shipping,
        productCodes: productCodes,
        requestId: lambdaRequestId
    }
    
    const envelope: Envelope = {
        eventType: eventType,
        data: JSON.stringify(orderEvent)
    }

    return snsClient.publish({
        TopicArn: orderEventsTopicArn,
        Message: JSON.stringify(envelope),
        MessageAttributes: {
            eventType: {
                DataType: 'String',
                StringValue: eventType
            }
        }
    }).promise()
} 

function convertToOrderResponse(order: IOrder): IOrderResponse {
    const orderProducts: IOrderProduct[] = []

    order.products.forEach((product) => {
        orderProducts.push({
            code: product.code,
            price: product.price
        })
    })
    
    const orderResponse: IOrderResponse = {
        email: order.pk,
        id: order.sk!,
        createdAt: order.createdAt!,
        products: orderProducts,
        billing: {
            payment: order.billing.payment as IPayment,
            totalPrice: order.billing.totalPrice
        },
        shipping: {
            type: order.shipping.type as IShipping,
            carrier: order.shipping.carrier as ICarrier
        }
    }

    return orderResponse
}

function buildOrder(orderRequest: IOrderRequest, products: IProduct[]): IOrder {
    const orderProducts: IOrderProduct[] = [] 
    let totalPrice = 0 as number

    products.forEach((product) => {
        totalPrice += product.price
        orderProducts.push({
            code: product.code,
            price: product.price
        })
    })

    const order: IOrder = {
        sk: uuid(),
        pk: orderRequest.email,
        billing: {
            payment: orderRequest.payment,
            totalPrice: totalPrice,
        },
        shipping: {
            type: orderRequest.shipping.type,
            carrier: orderRequest.shipping.carrier
        },
        products: orderProducts,
        createdAt: Date.now()
    }

    return order
}

export { handler }

