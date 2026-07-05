import { CfnOutput, Duration, Fn, RemovalPolicy, Stack, StackProps } from "aws-cdk-lib";
import { CorsHttpMethod, HttpApi } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  ViewerProtocolPolicy
} from "aws-cdk-lib/aws-cloudfront";
import { HttpOrigin, S3BucketOrigin } from "aws-cdk-lib/aws-cloudfront-origins";
import { AttributeType, BillingMode, Table } from "aws-cdk-lib/aws-dynamodb";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import { BlockPublicAccess, Bucket, BucketEncryption } from "aws-cdk-lib/aws-s3";
import { BucketDeployment, Source } from "aws-cdk-lib/aws-s3-deployment";
import { Construct } from "constructs";
import { join } from "node:path";

export class DriversLicENSeStack extends Stack {
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

    const apiFunction = new NodejsFunction(this, "ApiFunction", {
      runtime: Runtime.NODEJS_20_X,
      handler: "handler",
      entry: join(__dirname, "../../../../apps/api/src/lambda.ts"),
      timeout: Duration.seconds(30),
      memorySize: 512,
      bundling: {
        format: OutputFormat.CJS,
        minify: false,
        sourceMap: true,
        target: "node20",
        mainFields: ["module", "main"],
        externalModules: [
          "@fastify/static",
          "@fastify/view",
          "@nestjs/microservices",
          "@nestjs/platform-express",
          "@nestjs/websockets",
          "cache-manager",
          "class-transformer",
          "class-validator"
        ]
      },
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

    const websiteBucket = new Bucket(this, "WebsiteBucket", {
      encryption: BucketEncryption.S3_MANAGED,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY
    });

    const apiDomainName = Fn.select(2, Fn.split("/", api.apiEndpoint));
    const distribution = new Distribution(this, "WebsiteDistribution", {
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(websiteBucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
      },
      additionalBehaviors: {
        "documents*": {
          origin: new HttpOrigin(apiDomainName, {
            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY
          }),
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
        },
        "dashboard*": {
          origin: new HttpOrigin(apiDomainName, {
            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY
          }),
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS
        }
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(1)
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.minutes(1)
        }
      ]
    });

    new BucketDeployment(this, "WebsiteDeployment", {
      sources: [Source.asset(join(__dirname, "../../../../apps/web/build"))],
      destinationBucket: websiteBucket,
      distribution,
      distributionPaths: ["/*"]
    });

    new CfnOutput(this, "ApiEndpoint", {
      value: api.apiEndpoint
    });
    new CfnOutput(this, "WebsiteUrl", {
      value: `https://${distribution.distributionDomainName}`
    });
  }
}
