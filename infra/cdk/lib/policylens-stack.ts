import { Duration, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Code, Function, Runtime } from "aws-cdk-lib/aws-lambda";
import { HttpApi, CorsHttpMethod } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { join } from "node:path";

export class PolicyLensStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const documentBucket = new Bucket(this, "DocumentBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const documentTable = new Table(this, "DocumentTable", {
      partitionKey: {
        name: "id",
        type: AttributeType.STRING
      },
      billingMode: BillingMode.PAY_PER_REQUEST,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const apiFunction = new Function(this, "ApiFunction", {
      runtime: Runtime.NODEJS_20_X,
      handler: "lambda.handler",
      code: Code.fromAsset(join(__dirname, "../../../../apps/api/dist")),
      timeout: Duration.seconds(30),
      memorySize: 512,
      environment: {
        APP_MODE: "aws",
        STORAGE_ADAPTER: "s3",
        DB_ADAPTER: "dynamodb",
        OCR_ADAPTER: "textract",
        EXTRACTION_ADAPTER: "deterministic",
        DOCUMENT_BUCKET_NAME: documentBucket.bucketName,
        DOCUMENT_TABLE_NAME: documentTable.tableName,
        CORS_ORIGIN: "*"
      }
    });

    documentBucket.grantReadWrite(apiFunction);
    documentTable.grantReadWriteData(apiFunction);
    apiFunction.addToRolePolicy(
      new PolicyStatement({
        effect: Effect.ALLOW,
        actions: ["textract:DetectDocumentText", "textract:AnalyzeDocument"],
        resources: ["*"]
      })
    );

    const integration = new HttpLambdaIntegration("ApiIntegration", apiFunction);
    const api = new HttpApi(this, "HttpApi", {
      corsPreflight: {
        allowHeaders: ["content-type"],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.OPTIONS],
        allowOrigins: ["*"]
      }
    });

    api.addRoutes({
      path: "/{proxy+}",
      integration
    });
    api.addRoutes({
      path: "/",
      integration
    });
  }
}

