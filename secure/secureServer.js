const http = require('http');
const fs = require('fs');
const path = require('path');

http.createServer(function (request, response) {
    let filePath = '.' + request.url;
    if (filePath === './') {
        filePath = './Payments.html';
    }
    if (filePath.includes("..") || !filePath.endsWith(".html")) {
        response.writeHead(404);
        response.end('Sorry, that page does not exist.\n');
        response.end();
    }
    filePath = path.join(__dirname, filePath);
    //We're only serving HTML from this micro-server
    const contentType = 'text/html';

    fs.readFile(filePath, function(error, content) {
        if (error) {
            if(error.code == 'ENOENT') {
                response.writeHead(404);
                response.end('Sorry, that page does not exist.\n');
                response.end();
            }
            else {
                response.writeHead(500);
                response.end('Sorry, check with the site admin for error: '+error.code+'.\n');
                response.end();
            }
        }
        else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf-8');
        }
    });
}).listen(8125);
console.log('Server running on 8125...');
