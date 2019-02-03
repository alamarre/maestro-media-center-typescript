const http = require("http");
const als = require("async-local-storage");
als.enable();

const Koa = require("koa");
const Router = require("koa-router");
const bodyParser = require("koa-bodyparser");

const app = new Koa();
app.use(bodyParser());
const AWS = require("aws-sdk");

let port = 3000;
const portString = process.env.PORT;
if (portString) {
    port = parseInt(portString);
}

const cors = require("@koa/cors");
const defaultRouter = new Router();
app.use(cors());

const {loggingMiddleware, errorHandler,} = require("./impl/logger");
app.use(loggingMiddleware("Maestro Media Center"));
app.on("error", errorHandler);

const UserSpecificDb = require("./impl/aws/UserSpecificDb");
const DynamoDb = require("./impl/aws/DynamoDb");
const dynamoDb = new UserSpecificDb("db");

const DYNAMO_TABLE = process.env.DYNAMO_TABLE || "maestro-media-center";
const dynamoClient = new AWS.DynamoDB.DocumentClient();
const db = dynamoDb;
const globalDynamoDb = new DynamoDb(dynamoClient, DYNAMO_TABLE);
//const globalDb = new MigratingDb(globalDynamoDb, globalS3Db);
const globalDb = globalDynamoDb;

const authDB = new DynamoDb(dynamoClient, DYNAMO_TABLE, "admin_auth");

const healthApi = require("./apis/Health");
defaultRouter.get("/health", healthApi);

app.use(defaultRouter.routes());
app.use(defaultRouter.allowedMethods());

const SimplePasswordAuth = require("./impl/local/SimplePasswordAuth");
const LocalLogin = require("./apis/LocalLogin");
const loginRouter = Router({ prefix: "/api/v1.0/login", });
const loginApi = new LocalLogin(authDB, new SimplePasswordAuth(authDB), loginRouter);
app.use(async (ctx, next) => {
    await loginApi.validateAuth(ctx, next);
});
app.use(loginRouter.routes());
app.use(loginRouter.allowedMethods());

app.use(async (ctx, next) => {
    if(ctx.username) {
        als.scope();
        als.set("db", new DynamoDb(dynamoClient, DYNAMO_TABLE, ctx.accountId));

        if(!ctx.accountId) {
            ctx.accountId = process.env.MAIN_ACCOUNT;
        }
        await next();
    }
});

const metadataRouter = new Router({prefix: "/api/v1.0/metadata",});
const MetadataApi = require("./apis/admin/Metadata");
new MetadataApi(metadataRouter, db);
app.use(metadataRouter.routes());
app.use(metadataRouter.allowedMethods());

if(process.env.RUN_LOCAL) {
    const server = http.createServer(app.callback());
    server.listen(port, function listening() {
        console.log("Listening on %d", server.address().port);
    });
}
else {
    const serverless = require("serverless-http");
    module.exports.handler = serverless(app);
}

