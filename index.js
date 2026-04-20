const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
app.set("view engine", "ejs");

console.log("Folder index.js (__dirname):", __dirname);
console.log("Folder curent (de lucru) (process.cwd()):", process.cwd());
console.log("Cale fisier (__filename):", __filename);

let obGlobal = {
    obErori: null
};

const vect_foldere = ["temp", "logs", "backup", "fisiere_uploadate"];
for (let folder of vect_foldere) {
    let caleFolder = path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder, { recursive: true });
    }
}


function initErori() {
    try {
        let continut = fs.readFileSync(path.join(__dirname, "erori.json")).toString("utf-8");
        let erori = JSON.parse(continut);

        let err_default = erori.eroare_default;
        err_default.imagine = path.join("/", erori.cale_baza, err_default.imagine);

        for (let eroare of erori.info_erori) {
            eroare.imagine = path.join("/", erori.cale_baza, eroare.imagine);
        }
        obGlobal.obErori = erori;
    } catch (e) {
        console.error("Nu am putut citi fisierul erori.json:", e);
    }
}

initErori();

function afisareEroare(res, identificator, titlu, text, imagine) {
    let erori = obGlobal.obErori;
    let eroare = null;
    let errDefault = erori.eroare_default;

    if (identificator) {
        eroare = erori.info_erori.find((elem) => elem.identificator === identificator);
    }

    let obDateEroare = {
        titlu: titlu || (eroare ? eroare.titlu : errDefault.titlu),
        text: text || (eroare ? eroare.text : errDefault.text),
        imagine: imagine || (eroare ? eroare.imagine : errDefault.imagine)
    };

    if (eroare && eroare.status) {
        res.status(eroare.identificator);
    }

    res.render("pagini/eroare", obDateEroare);
}

app.use(function (req, res, next) {
    if (req.url.endsWith(".ejs")) {
        afisareEroare(res, 400);
    } else {
        next();
    }
});

app.use("/resurse", function (req, res, next) {
    if (path.extname(req.url) === "") {
        afisareEroare(res, 403);
    } else {
        next();
    }
});

app.use("/resurse", express.static(path.join(__dirname, "resurse")));

app.get("/favicon.ico", function (req, res) {
    res.sendFile(path.join(__dirname, "resurse/imagini/favicon/favicon.ico"));
});

app.get(["/", "/index", "/home"], function (req, res) {
    res.render("pagini/index", {
        ip: req.ip
    });
});

app.get("/*", function (req, res) {
    let pathCerut = req.params[0];

    res.render("pagini/" + pathCerut, { ip: req.ip }, function (err, rezRandare) {
        if (err) {
            if (err.message.startsWith("Failed to lookup view")) {
                afisareEroare(res, 404);
            } else {
                afisareEroare(res, null);
            }
        } else {
            res.send(rezRandare);
        }
    });
});

app.listen(8080, () => {
    console.log("Server asculta pe portul 8080");
});