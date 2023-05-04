const express = require("express");
const Busboy = require('busboy');
const https = require("https");
const { tokenGenerate } = require('@vonage/jwt'); 

const port = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.post("/upload", (request, response) => {
  const busboy = Busboy({ headers: request.headers });
  const files = [];
  const buffers = {};
  const fields = {};

  busboy.on("field", function(fieldname,val) {
    fields[fieldname] = val;
  });

  busboy.on("file", function(fieldname, file, filename, encoding, mimetype) {
    buffers[fieldname] = [];
    file.on("data", data => {
      buffers[fieldname].push(data);
    });

    file.on("end", () => {
      files.push({
        fileBuffer: Buffer.concat(buffers[fieldname]),
        fileType: mimetype,
        fileName: filename,
        fileEnc: encoding
      });
    });
  });

  busboy.on("finish", async function() {
    const processResponse = await processFiles(files, fields['appid'], fields['password']);
    response.status(200).send(processResponse);
  });

  return request.pipe(busboy);
});

async function processFiles(files, appId, password) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.nexmo.com",
      path: `/v1/applications/${appId}/push_tokens/ios`,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + getJwt(appId, files[0].fileBuffer)
      }
    };

    const data = {
      token: files[1].fileBuffer
        .toString("hex")
        .match(/../g)
        .join("")
    };

    if (password) {
      data.password = password;
    }

    const dataJson = JSON.stringify(data);
    console.log(dataJson)

    const req = https.request(options, res => {
      console.log(`statusCode: ${res.statusCode}`);
      console.log(`res: ${res.statusMessage}`);
      res.setEncoding("utf8");
      res.on("data", d => {
        console.log(d);
      });
      res.on("end", function() {
        resolve({ message: res.statusMessage, code: res.statusCode });
      });
    });

    req.on("error", error => {
      console.error(error);
      reject(error);
    });

    req.write(dataJson);
    req.end();
  });
}

const listener = app.listen(port, () => {
  console.log("App available at: http://localhost:" + listener.address().port + "/");
});

function getJwt(appId, privateKeyBuffer) {
  const jwt = tokenGenerate(
    appId,
    privateKeyBuffer,
    {
    exp: Math.round(new Date().getTime() / 1000) + 120,
    acl: {
      paths: {
        "/*/users/**": {},
        "/*/conversations/**": {},
        "/*/sessions/**": {},
        "/*/devices/**": {},
        "/*/image/**": {},
        "/*/media/**": {},
        "/*/applications/**": {},
        "/*/push/**": {},
        "/*/knocking/**": {}
      }
    }
  });

  return jwt;
}
