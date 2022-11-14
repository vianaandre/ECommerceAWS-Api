import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as lambdaNodeJS from 'aws-cdk-lib/aws-lambda-nodejs'
import * as cdk from 'aws-cdk-lib'
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { Construct } from 'constructs'
import * as ssm from 'aws-cdk-lib/aws-ssm'
import * as iam from 'aws-cdk-lib/aws-iam'

interface IProductsAppStack extends cdk.StackProps {
    eventsDdb: dynamodb.Table
}

class ProductsAppStack extends cdk.Stack {
    readonly productsFetchHandler: lambdaNodeJS.NodejsFunction
    readonly productsAdminHandler: lambdaNodeJS.NodejsFunction
    readonly productsDdb: dynamodb.Table
    
    constructor(
        scope: Construct,
        id: string,
        props: IProductsAppStack
    ) {
        super(scope, id, props)

        this.productsDdb = new dynamodb.Table(this, 'ProductsDdb', {
            tableName: 'products',
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            partitionKey: {
                name: 'id',
                type: dynamodb.AttributeType.STRING
            },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1
        })

        // Layers Products
        const productsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductsLayerVersionArn') 
        const productsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductsLayerVersionArn', productsLayerArn)

        // Layer ProductEvents
        const productEventsLayerArn = ssm.StringParameter.valueForStringParameter(this, 'ProductEventsLayerVersionArn')
        const productEventsLayer = lambda.LayerVersion.fromLayerVersionArn(this, 'ProductEventsLayerVersionArn', productEventsLayerArn)

        const productEventsHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductEventsFunction', {
            functionName: 'ProductEventsFunction',
            entry: 'lambda/products/productsEventsFunction.ts',
            handler: 'handler',
            memorySize: 128,
            timeout: cdk.Duration.seconds(2),
            bundling: {
                minify: true,
                sourceMap: false
            },
            environment: {
                EVENTS_DDB: props.eventsDdb.tableName
            },
            layers: [ productEventsLayer ],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
        })

        const eventsDdbPolicy = new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: ['dynamodb:PutItem'],
            resources: [props.eventsDdb.tableArn],
            conditions: {
                ['ForAllValues:StringLike']: {
                    'dynamodb:LeadingKeys': ['#product_*']
                }
            }
        })
        productEventsHandler.addToRolePolicy(eventsDdbPolicy)

        this.productsFetchHandler = new lambdaNodeJS.NodejsFunction(this, "ProductsFetchFunction", {
            functionName: 'ProductsFetchFunction',
            entry: 'lambda/products/productsFetchFunction.ts',
            handler: 'handler',
            memorySize: 128, // MB
            timeout: cdk.Duration.seconds(5),
            bundling: {
                minify: true,
                sourceMap: false
            },
            environment: {
                PRODUCTS_DDB: this.productsDdb.tableName
            },
            layers: [ productsLayer ],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
        })

        this.productsAdminHandler = new lambdaNodeJS.NodejsFunction(this, 'ProductsAdminFunction', {
            functionName: 'ProductsAdminFunction',
            entry: 'lambda/products/productsAdminFunction.ts',
            handler: 'handler',
            memorySize: 128, // MB
            timeout: cdk.Duration.seconds(5),
            bundling: {
                minify: true,
                sourceMap: false
            },
            environment: {
                PRODUCTS_DDB: this.productsDdb.tableName,
                PRODUCT_EVENTS_FUNCTION_NAME: productEventsHandler.functionName
            },
            layers: [ productsLayer, productEventsLayer ],
            tracing: lambda.Tracing.ACTIVE,
            insightsVersion: lambda.LambdaInsightsVersion.VERSION_1_0_119_0
        })

        // Permission dynamodb
        this.productsDdb.grantReadData(this.productsFetchHandler)
        this.productsDdb.grantWriteData(this.productsAdminHandler)

        // Permition from stack ProductsEvents
        productEventsHandler.grantInvoke(this.productsAdminHandler)
    }
}

export { ProductsAppStack }