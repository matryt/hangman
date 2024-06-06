const url = require("url");
const path = require("path");
const fs = require("fs");

const defaultURL = "index.html";

const front = "./front";
const mimeTypes = {
    '.ico': 'image/x-icon',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.svg': 'image/svg+xml',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.md': 'text/plain',
    'default': 'application/octet-stream'
};

function manageRequest(request, response) {
    console.log(request.url);
    if (request.url.includes("..")) {
        response.statusCode = 403;
        response.end("Vous n'avez pas le droit d'accéder à ce fichier !");
        return;
    }
    const parse = url.parse(request.url);
    const URLparts = parse.pathname.split("/");
    let filename;

    if (URLparts.length >= 2) {
        filename = front + "/" + URLparts.pop();
    }
    else {
        filename = front;
    }
    console.log("filename : " + filename);
    try {
        let file = fs.statSync(filename);
        if (file.isDirectory()) {
            filename = filename + "/" + defaultURL;
        }
        console.log(filename);
        try {
            fs.readFile(filename, (err, data) => {
                if (err) throw err;
                response.statusCode = 200;
                response.setHeader("Content-Type", mimeTypes[path.parse(filename).ext]);
                response.end(data);
            });
        } catch(e) {
            response.statusCode = 400;
            response.end(e.message);
        }
    } catch (e) {
        response.statusCode = 404;  
        fs.readFile("./front/notfound.html", (err, data) => {
            response.end(data);
        });
    }
}

exports.manage = manageRequest;