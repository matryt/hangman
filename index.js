const http = require("http");
const api = require("./api");
const files = require("./files");

function handleRequest(req, rep) {
    let urlParts = req.url.split("/");
    switch (urlParts[1]) {
        case "api": {
            api.manage(req, rep).then();
            break;
        }
        default: {
            files.manage(req, rep);
            break;
        }
    }
}

function parseJsonBody(req, res, next) {
    let body = '';
    req.on('data', chunk => {
        body += chunk;
    });
    req.on('end', () => {
        try {
            const parsedBody = JSON.parse(body);
            req.body = parsedBody;

        } catch (error) {
        }
        next();
    });
}

const server = http.createServer((req, res) => {
    parseJsonBody(req, res, () => {
        handleRequest(req, res);
    });
});
server.listen(process.env.PORT);