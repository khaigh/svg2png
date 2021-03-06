"use strict";
const path = require("path");
const fileURL = require("file-url");
const childProcess = require("pn/child_process");

const phantomjsCmd = require("phantomjs-prebuilt").path;
const converterFileName = path.resolve(__dirname, "./converter.js");

const createFromPhantomNodePage = require("./phantomNode");

const PREFIX = "data:image/png;base64,";

module.exports = (sourceBuffer, options) => {
    return Promise.resolve().then(() => { // catch thrown errors
        if (options && options.phantomJS !== undefined) {
            return createFromPhantomNodePage(sourceBuffer, options);
        }
        const cp = childProcess.execFile(phantomjsCmd, getPhantomJSArgs(options), { maxBuffer: Infinity });

        writeBufferInChunks(cp.stdin, sourceBuffer);

        return cp.promise.then(processResult);
    });
};

module.exports.sync = (sourceBuffer, options) => {
    const result = childProcess.spawnSync(phantomjsCmd, getPhantomJSArgs(options), {
        input: sourceBuffer.toString("utf8")
    });
    return processResult(result);
};

function getPhantomJSArgs(_options) {
    const options = _options || {};
    if (options.filename !== undefined && options.url !== undefined) {
        throw new Error("Cannot specify both filename and url options");
    }

    // Convert filename option to url option
    if (options.filename !== undefined) {
        options = Object.assign({ url: fileURL(options.filename) }, options);
        delete options.filename;
    }

    return [
        converterFileName,
        JSON.stringify(options)
    ];
}

function writeBufferInChunks(writableStream, buffer) {
    const asString = buffer.toString("utf8");

    const INCREMENT = 1024;

    writableStream.cork();
    for (let offset = 0; offset < asString.length; offset += INCREMENT) {
        writableStream.write(asString.substring(offset, offset + INCREMENT));
    }
    writableStream.end();
}

function processResult(result) {
    const stdout = result.stdout.toString();
    if (stdout.startsWith(PREFIX)) {
        return new Buffer(stdout.substring(PREFIX.length), "base64");
    }

    if (stdout.length > 0) {
        // PhantomJS always outputs to stdout.
        throw new Error(stdout.replace(/\r/g, "").trim());
    }

    const stderr = result.stderr.toString();
    if (stderr.length > 0) {
        // But hey something else might get to stderr.
        throw new Error(stderr.replace(/\r/g, "").trim());
    }

    throw new Error("No data received from the PhantomJS child process");
}
