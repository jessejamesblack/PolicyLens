#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DriversLicENSeStack } from "../lib/driverslicense-stack";

const app = new cdk.App();
const existingStackId = ["Policy", "Lens", "Stack"].join("");

new DriversLicENSeStack(app, existingStackId, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION ?? "us-east-2"
  }
});
