const express = require("express");
const path = require("path");
const fs = require("fs");
const sass = require("sass");
const sharp = require("sharp");

const app = express();
app.set("view engine", "ejs");

let obGlobal = {
    obErori: null,
    obImagini: null,
    folderScss: path.join(__dirname, "resurse", "scss"),
    folderCss: path.join(__dirname, "resurse", "css")
};

console.log("Folder index.js", __dirname);
console.log("Folder curent (de lucru)", process.cwd());
console.log("Cale fisier", __filename);

let vect_foldere = ["temp", "logs", "backup", "backup/resurse/css", "fisiere_uploadate"];
for (let folder of vect_foldere) {
    let caleFolder = path.join(__dirname, folder);
    if (!fs.existsSync(caleFolder)) {
        fs.mkdirSync(caleFolder, { recursive: true });
    }
}

// SCSS compilation logic
function compileazaScss(caleScss, caleCss) {
    let absoluteCaleScss = path.isAbsolute(caleScss) ? caleScss : path.join(obGlobal.folderScss, caleScss);
    let absoluteCaleCss = caleCss;
    
    if (!absoluteCaleCss) {
        let fileName = path.basename(absoluteCaleScss, ".scss");
        absoluteCaleCss = path.join(obGlobal.folderCss, fileName + ".css");
    } else if (!path.isAbsolute(absoluteCaleCss)) {
        absoluteCaleCss = path.join(obGlobal.folderCss, absoluteCaleCss);
    }

    // Backup
    if (fs.existsSync(absoluteCaleCss)) {
        try {
            let backupPath = path.join(__dirname, "backup", "resurse", "css", path.basename(absoluteCaleCss));
            fs.copyFileSync(absoluteCaleCss, backupPath);
        } catch (err) {
            console.error("Eroare la crearea backup-ului pentru " + absoluteCaleCss, err);
        }
    }

    try {
        let rezultat = sass.compile(absoluteCaleScss);
        fs.writeFileSync(absoluteCaleCss, rezultat.css);
        console.log("Compilat cu succes:", absoluteCaleScss, "->", absoluteCaleCss);
    } catch (err) {
        console.error("Eroare compilare SCSS " + absoluteCaleScss, err.message);
    }
}

if (fs.existsSync(obGlobal.folderScss)) {
    let fisiere = fs.readdirSync(obGlobal.folderScss);
    for (let fisier of fisiere) {
        if (path.extname(fisier) === ".scss") {
            compileazaScss(fisier);
        }
    }

    fs.watch(obGlobal.folderScss, (eventType, fisier) => {
        if (fisier && path.extname(fisier) === ".scss") {
            console.log(`Fișierul ${fisier} s-a modificat (eveniment: ${eventType})`);
            if (fs.existsSync(path.join(obGlobal.folderScss, fisier))) {
                compileazaScss(fisier);
            }
        }
    });
}

app.use("/resurse", express.static(path.join(__dirname, "resurse")));

app.get("/favicon.ico", function(req, res){
    res.sendFile(path.join(__dirname, "resurse/imagini/favicon/favicon.ico"));
});

app.get(["/", "/index", "/home"], function(req, res){
    res.render("pagini/index", {
        ip: req.ip
    });
});

app.get("/galerii", function(req, res){
    let lunaCurenta = luniAn[new Date().getMonth()];
    let imaginiFiltrate = obGlobal.obImagini.filter(imag => imag.luni.includes(lunaCurenta)).slice(0, 12);
    
    // Galerie Animata: numar impar 5-11
    let nrImagini = Math.floor(Math.random() * 4) * 2 + 5; 
    let imaginiAnimata = obGlobal.obImagini.slice(-nrImagini);
    
    // Scriere variabile SCSS
    let varsScssPath = path.join(obGlobal.folderScss, "_galerie_animata_vars.scss");
    let continutVars = `$nr-imagini: ${nrImagini};\n`;
    fs.writeFileSync(varsScssPath, continutVars);
    compileazaScss("galerie_animata.scss");
    
    res.render("pagini/galerii", {
        imagini: imaginiFiltrate,
        imaginiAnimata: imaginiAnimata
    });
});

app.get("/despre", function(req, res){
    res.render("pagini/despre");
});

function initErori(){
    let continut = fs.readFileSync(path.join(__dirname, "resurse/json/erori.json")).toString("utf-8");
    let erori = JSON.parse(continut);
    obGlobal.obErori = erori;
    
    let err_default = erori.eroare_default;
    err_default.imagine = path.join(erori.cale_baza, err_default.imagine);
    
    for (let eroare of erori.info_erori){
        eroare.imagine = path.join(erori.cale_baza, eroare.imagine);
    }
}
initErori();

const luniAn = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august", "septembrie", "octombrie", "noiembrie", "decembrie"];

function initImagini() {
    let continut = fs.readFileSync(path.join(__dirname, "resurse/json/galerie.json")).toString("utf-8");
    let obGalerie = JSON.parse(continut);
    let imagini = obGalerie.imagini;
    for (let imag of imagini) {
        imag.cale_absoluta = path.join(__dirname, obGalerie.cale_galerie, imag.cale_fisier);
        imag.cale_fisier_relativ = path.join(obGalerie.cale_galerie, imag.cale_fisier);
        
        let numeFisier = path.basename(imag.cale_fisier, path.extname(imag.cale_fisier));
        imag.cale_fisier_mediu = path.join(obGalerie.cale_galerie, numeFisier + "-mediu.webp");
        let caleAbsMediu = path.join(__dirname, imag.cale_fisier_mediu);
        
        if (!fs.existsSync(caleAbsMediu)) {
            sharp(imag.cale_absoluta).resize(400).toFormat('webp').toFile(caleAbsMediu).catch(err => console.error("Eroare sharp:", err));
        }
    }
    obGlobal.obImagini = imagini;
}
initImagini();

function afisareEroare(res, identificator, titlu, text, imagine){
    let eroare = obGlobal.obErori.info_erori.find((elem) => 
        elem.identificator == identificator
    );

    let errDefault = obGlobal.obErori.eroare_default;
    if(eroare?.status) {
        res.status(eroare.identificator);
    }
        
    res.render("pagini/eroare", {
        imagine: imagine || eroare?.imagine || errDefault.imagine,
        titlu: titlu || eroare?.titlu || errDefault.titlu,
        text: text || eroare?.text || errDefault.text,
    });
}

app.get("/eroare", function(req, res){
    afisareEroare(res, 404, "Eroare provocata manual");
});

app.get("/*pagina", function(req, res){
    console.log("Cale pagina", req.url);
    if (req.url.startsWith("/resurse") && path.extname(req.url) == ""){
        afisareEroare(res, 403);
        return;
    }
    if (path.extname(req.url) == ".ejs"){
        afisareEroare(res, 400);
        return;
    }
    try {
        res.render("pagini" + req.url, function(err, rezRandare){
            if (err){
                if (err.message.includes("Failed to lookup view")){
                    afisareEroare(res, 404);
                }
                else{
                    afisareEroare(res);
                }
            }
            else{
                res.send(rezRandare);
            }
        });
    }
    catch(err){
        if (err.message.includes("Cannot find module")){
            afisareEroare(res, 404);
        }
        else{
            afisareEroare(res);
        }
    }
});

app.listen(8080, () => {
    console.log("Serverul a pornit pe portul 8080!");
});
