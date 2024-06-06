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
            req.body = JSON.parse(body);

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