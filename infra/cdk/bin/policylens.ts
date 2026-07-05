#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { PolicyLensStack } from "../lib/policylens-stack";

const app = new cdk.App();

new PolicyLensStack(app, "PolicyLensStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-1"
  }
});

