# mysqldump-to-s3

AWS Lambda function to export MySQL databases to AWS S3.

## Prequisites

This package uses node-lambda to deploy to AWS Lambda. If you haven't already installed it, you can do so using the following command

```
npm install -g node-lambda
```

## Setup

Create a `.env` file, and populate with your appropriate configuration settings.

An example file is provided 

```
cp example.env .env
```

Once you have configured the function you are now good to deploy

## Deployment to AWS Lambda

The function can be deployed to Lambda using the following command

`node-lambda deploy`


### That's it. Enjoy!
