import * as cdk  from 'aws-cdk-lib'
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs'
import * as apigateway from 'aws-cdk-lib/aws-apigateway'
import * as cwlogs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

interface IEcommerceApiStackProps extends cdk.StackProps {
    productsFetchHandler: lambdaNodeJs.NodejsFunction
    productsAdminHandler: lambdaNodeJs.NodejsFunction
    ordersHandler: lambdaNodeJs.NodejsFunction
}

export class ECommerceApiStack extends cdk.Stack {
    
    constructor(
        scope: Construct,
        id: string,
        props: IEcommerceApiStackProps
    ) {
        super(scope, id, props)

        const logGroup = new cwlogs.LogGroup(this, 'ECommerceApiLogs')

        const api = new apigateway.RestApi(this, 'ECommerceApi', {
            restApiName: 'ECommerceApi',
            cloudWatchRole: true,
            deployOptions: {
                accessLogDestination: new apigateway.LogGroupLogDestination(logGroup),
                accessLogFormat: apigateway.AccessLogFormat.jsonWithStandardFields({
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    caller: true,
                    user: true
                })
            }
        })

        this.createProductsService(props, api)

        this.createOrdersService(props, api)
    }

    private createProductsService(props: IEcommerceApiStackProps, api: cdk.aws_apigateway.RestApi) {
        const productsFetchIntegration = new apigateway.LambdaIntegration(props.productsFetchHandler)
        const productsAdminIntegration = new apigateway.LambdaIntegration(props.productsAdminHandler)

        const productsResource = api.root.addResource('products')
        const productsIdResource = productsResource.addResource('{id}')

        // GET "/products"
        productsResource.addMethod('GET', productsFetchIntegration)

        // GET "/product/{id}"
        productsIdResource.addMethod('GET', productsFetchIntegration)

        // POST "/products"
        const productCreatedRequestValidator = new apigateway.RequestValidator(this, 'ProductCreatedRequestValidator', {
            restApi: api,
            requestValidatorName: 'ProductCreatedRequestValidator',
            validateRequestBody: true
        })
        const productModel = new apigateway.Model(this, 'ProductModel', {
            restApi: api,
            modelName: 'ProductModel',
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    productName: {
                        type: apigateway.JsonSchemaType.STRING,
                    },
                    code: {
                        type: apigateway.JsonSchemaType.STRING,
                    },
                    price: {
                        type: apigateway.JsonSchemaType.NUMBER,
                    },
                    model: {
                        type: apigateway.JsonSchemaType.STRING,
                    },
                    productUrl: {
                        type: apigateway.JsonSchemaType.STRING,
                    }
                },
                required: [
                    'productName',
                    'code',
                    'price',
                    'model',
                    'productUrl'
                ]
            }
        })

        productsResource.addMethod('POST', productsAdminIntegration, {
            requestValidator: productCreatedRequestValidator,
            requestModels: {
                "application/json": productModel
            }
        })

        // PUT "/products/{id}"
        const productUpdatedRequestValidator = new apigateway.RequestValidator(this,'ProductUpdatedRequestValidator', {
            restApi: api,
            requestValidatorName: 'ProductUpdatedRequestValidator',
            validateRequestParameters: true,
            validateRequestBody: true
        })
        
        productsIdResource.addMethod('PUT', productsAdminIntegration, {
            requestValidator: productUpdatedRequestValidator,
            requestParameters: {
                'method.request.path.id': true
            },
            requestModels: {
                "application/json": productModel
            }
        })

        // DELETE "/products/{id}" 
        productsIdResource.addMethod('DELETE', productsAdminIntegration)
    }

    private createOrdersService(props: IEcommerceApiStackProps, api: cdk.aws_apigateway.RestApi) {
        const ordersIntegration = new apigateway.LambdaIntegration(props.ordersHandler)

        const ordersResource = api.root.addResource('orders')

        // GET "/orders"
        // GET "/orders?email="
        // GET "/orders?email={email}&orderId={id}"
        ordersResource.addMethod('GET', ordersIntegration)

        const orderDeletedValidation = new apigateway.RequestValidator(this, 'OrdersDeletedValition', {
            restApi: api,
            requestValidatorName: 'OrdersDeletedValition',
            validateRequestParameters: true
        })
        // DELETE "/orders?email={email}&orderId={id}"
        ordersResource.addMethod('DELETE', ordersIntegration, {
            requestParameters: {
                'method.request.querystring.email': true,
                'method.request.querystring.orderId': true
            },
            requestValidator: orderDeletedValidation
        })

        const orderRequestValidator = new apigateway.RequestValidator(this, 'OrderRequestValidator', {
            restApi: api,
            requestValidatorName: 'OrderRequestValidator',
            validateRequestBody: true
        })
        const orderModel = new apigateway.Model(this, 'OrderModel', {
            restApi: api,
            modelName: 'OrderMOdel',
            schema: {
                type: apigateway.JsonSchemaType.OBJECT,
                properties: {
                    email: {
                        type: apigateway.JsonSchemaType.STRING, 
                    },
                    productsId: {
                        type: apigateway.JsonSchemaType.ARRAY,
                        minItems: 1,
                        items: {
                            type: apigateway.JsonSchemaType.STRING
                        }
                    },
                    payment: {
                        type: apigateway.JsonSchemaType.STRING,
                        enum: ["CASH", "DEBIT_CARD", "CREDIT_CARD"]
                    },
                },
                required: [
                    "email",
                    "productsId",
                    "payment"
                ]
            }
        })
        // POST "/orders"
        ordersResource.addMethod('POST', ordersIntegration, {
            requestValidator: orderRequestValidator,
            requestModels: {
                "application/json": orderModel
            }
        })

    }
}