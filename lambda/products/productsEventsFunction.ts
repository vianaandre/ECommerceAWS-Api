import { IProductEvent } from "/opt/nodejs/productEventsLayer";
import { Context, Callback } from 'aws-lambda'
import { DynamoDB } from "aws-sdk";
import * as AWSXRay from 'aws-xray-sdk'

AWSXRay.captureAWS(require('aws-sdk'))

const eventsDdb = process.env.EVENTS_DDB!
const ddbClient = new DynamoDB.DocumentClient()

async function handler(event: IProductEvent, context: Context, callback: Callback): Promise<void> {
    console.log(event)

    console.log(`Lambda requestId: ${context.awsRequestId}`)

    await createEvent(event)

    callback(null, JSON.stringify({
        productEventCreated: true,
        message: 'OK'
    }))
}

function createEvent(event: IProductEvent) {
    const timestamp = Date.now()
    const ttl = ~~(timestamp / 1000 + 5 + 60) // 5 minutes

    return ddbClient.put({
        TableName: eventsDdb,
        Item: {
           pk: `#product_${event.productCode}`,
           sk: `${event.eventType}#${timestamp}`,
           email: event.email,
           createdAt: timestamp,
           requestId: event.requestId,
           eventType: event.eventType,
           info: {
            productId: event.productId,
            price: event.productPrice
           },
           ttl: ttl
        }
    }).promise()
}

export { handler }