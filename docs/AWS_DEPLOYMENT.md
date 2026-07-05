# AWS Deployment

DriversLicENSe deploys with AWS CDK. The stack publishes the SvelteKit static site through CloudFront and routes API paths to the Lambda-hosted NestJS API for synthetic driver license processing.

## Local AWS CLI

On Windows, this machine has AWS CLI v2 installed at:

```powershell
C:\Program Files\Amazon\AWSCLIV2\aws.exe
```

Use a local profile with short-lived credentials when possible:

```powershell
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" configure sso --profile personal
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" sso login --profile personal
$env:AWS_PROFILE = "personal"
```

If SSO is not available for the account, run the standard AWS CLI configuration prompt instead:

```powershell
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" configure --profile personal
$env:AWS_PROFILE = "personal"
```

Verify the active identity before deploying:

```powershell
& "C:\Program Files\Amazon\AWSCLIV2\aws.exe" sts get-caller-identity --profile personal
```

## Local Deploy

```powershell
$env:AWS_PROFILE = "personal"
$env:AWS_REGION = "us-east-2"
npm.cmd run bootstrap --workspace @driverslicense/cdk
npm.cmd run deploy --workspace @driverslicense/cdk -- --require-approval never
```

## GitHub Actions Deploy

The repository has two workflows:

- `CI`: runs production audit, architecture checks, build, tests, golden-sample harness, and CDK synth.
- `Deploy`: runs the same verification loop, assumes an AWS role through GitHub OIDC, bootstraps CDK, and deploys the stack.

The deploy workflow expects one GitHub secret:

```text
AWS_DEPLOY_ROLE_ARN=arn:aws:iam::<AWS_ACCOUNT_ID>:role/DriversLicENSeGithubDeployRole
```

## AWS OIDC Setup

Create an IAM OIDC provider for GitHub Actions:

```powershell
aws iam create-open-id-connect-provider `
  --url https://token.actions.githubusercontent.com `
  --client-id-list sts.amazonaws.com
```

Create a deploy role with this trust policy, replacing `<AWS_ACCOUNT_ID>` if you save it as JSON:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::<AWS_ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:jessejamesblack/DriversLicENSe:ref:refs/heads/main"
        }
      }
    }
  ]
}
```

For a compact experimentation account, the simplest initial path is attaching `AdministratorAccess` to `DriversLicENSeGithubDeployRole`, then tightening permissions after the stack stabilizes. Use a dedicated AWS account or budget-limited sandbox for this project.

After the role exists, add the role ARN to the repository secret named `AWS_DEPLOY_ROLE_ARN`.

## Outputs

CDK prints:

- `WebsiteUrl`: public CloudFront URL for the SvelteKit site.
- `ApiEndpoint`: direct API Gateway URL.

The hosted site uses same-origin API calls through CloudFront, so visitors do not need AWS credentials.
