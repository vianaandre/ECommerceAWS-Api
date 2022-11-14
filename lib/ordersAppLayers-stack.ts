import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as ssm from 'aws-cdk-lib/aws-ssm'

class OrdersAppLayersStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props)

        const ordersLayer = new lambda.LayerVersion(this, 'OrdersLayer', {
            code: lambda.Code.fromAsset('lambda/orders/layers/ordersLayer'),
            compatibleRuntimes: [ lambda.Runtime.NODEJS_14_X ],
            layerVersionName: 'OrdersLayer',
            removalPolicy: cdk.RemovalPolicy.RETAIN
        })

        const ordersApiLayer = new lambda.LayerVersion(this, 'OrdersApiLayer', {
            code: lambda.Code.fromAsset('lambda/orders/layers/ordersApiLayer'),
            compatibleRuntimes: [ lambda.Runtime.NODEJS_14_X ],
            layerVersionName: 'OrdersApiLayer',
            removalPolicy: cdk.RemovalPolicy.RETAIN
        })

        const orderEventsLayer = new lambda.LayerVersion(this, 'orderEventsLayer', {
            code: lambda.Code.fromAsset('lambda/orders/layers/orderEventsLayer'),
            compatibleRuntimes: [ lambda.Runtime.NODEJS_14_X ],
            layerVersionName: 'OrderEventsLayer',
            removalPolicy: cdk.RemovalPolicy.RETAIN
        })

        const orderEventsRepositoryLayer = new lambda.LayerVersion(this, 'orderEventsRepositoryLayer', {
            code: lambda.Code.fromAsset('lambda/orders/layers/orderEventsRepositoryLayer'),
            compatibleRuntimes: [ lambda.Runtime.NODEJS_14_X ],
            layerVersionName: 'OrderEventsRepositoryLayer',
            removalPolicy: cdk.RemovalPolicy.RETAIN
        })

        new ssm.StringParameter(this, 'OrdersLayerVersionArn', {
            parameterName: 'OrdersLayerVersionArn',
            stringValue: ordersLayer.layerVersionArn
        })

        new ssm.StringParameter(this, 'OrdersApiLayerVersionArn', {
            parameterName: 'OrdersApiLayerVersionArn',
            stringValue: ordersApiLayer.layerVersionArn
        })

        new ssm.StringParameter(this, 'OrderEventsLayerVersionArn', {
            parameterName: 'OrderEventsLayerVersionArn',
            stringValue: orderEventsLayer.layerVersionArn
        })

        new ssm.StringParameter(this, 'OrderEventsRepositoryLayerVersionArn', {
            parameterName: 'OrderEventsRepositoryLayerVersionArn',
            stringValue: orderEventsRepositoryLayer.layerVersionArn
        })
    }
}

export { OrdersAppLayersStack }