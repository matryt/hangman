let fs = require("fs");
let admin = require("firebase-admin");
let serviceAccount = require("./firebase.json");
const {getFirestore} = require("firebase-admin/firestore");
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const jwt = require("jsonwebtoken");
require('dotenv').config()


const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = getFirestore(app);
const usersRef = db.collection("users");
const rankingRef = db.collection("ranking")

const MAX_LENGTH = 17;
const MAX_ERRORS = 7;
const LEVELS = {
    "easy": [4, 7],
    "medium": [8, 10],
    "hard": [11, 15]
}
const LEVELS_NAMES = ["easy", "medium", "hard"]
const EVENT_POINTS = {
    "GOOD_LETTER": 5,
    "BAD_LETTER": -5,
    "FIND_WORD": 15,
    "": 0
}

let words = [[]];
let gameInstances = {};
fs.readFile("./lesmiserables.txt", (error, data) => {
    if (error) {
        console.error(error);
        return;
    }
    let allowedWords = data.toString('utf8').split(/[(\r?\n),. ]/);
    for (let word of allowedWords) {
        if (isWordValid(word)) {
            putWord(word);
        }
    }
});

function isWordValid(word) {
    return (isLowerCase(word) && !(words.includes(word)));
}

function putWord(word) {
    if (words[word.length]) words[word.length].push(word);
    else {
        let array = [];
        array.push(word);
        words[word.length] = array;
    }
}

function isLowerCase(word) {
    for (let char of word) {
        let code = char.charCodeAt(0);
        if ((code < 97) || (code > 122)) return false;
    }
    return true;
}

function urlParts(url) {
    let [firstPart, params] = url.split("?");
    return {
        "params": params,
        "endpoint": firstPart.split("api/")[1]
    };
}



async function manageRequest(request, response) {
    let data = urlParts(request.url);
    switch (data["endpoint"]) {
        case ("getWord"): {
            if (!(data["params"])) {
                raiseError(response, `Aucun paramètre présent ! Veuillez vérifier votre requête.`);
                return;
            }
            let array = manageGetWordParams(data["params"], response);
            if (array) {
                [min, max] = array;
                response.end("Voici le mot : " + getWord(min, max));
            }
            return;
        }
        case ("newGame"): {
            let returnData = newGame(data["params"], response, request.headers);
            if (returnData) {
                response.statusCode = 200;
                response.end(JSON.stringify(returnData));
            }
            break;
        }
        case ("testLetter"): {
            testLetter(data["params"], response, request.headers).then();
            break;
        }
        case ("signup"): {
            let array = await manageSignBody(request.body, response)
            if (!array) return false;
            let [email, password, pseudo] = array;
            signup(email, password, pseudo)
                .then(x => {
                    response.statusCode = 201;
                    response.end("OK !")
                });
            break;
        }
        case ("signin"): {
            let array = await manageSignBody(request.body, response, false)
            if (!array) return false;
            let [email, password, pseudo] = array;
            await signin(email, password, response);
            break;
        }
        case ("points"): {
                let user = managePointsBody(request.body, response, false)
                if (!user) return false;
                let points = await getPoints(user, response);
                if (points === false) return false;
                response.end(JSON.stringify({
                    "points": points
                }));
                break;
        }
        case ("ranking"): {
            getRanking().then(r => {
                response.end(JSON.stringify({
                    "ranking": r
                }));
            });
            break;
        }
        case ("gameState"): {
            let token = getToken(request.headers, response);
            if (!token) return false;
            let array = verifyToken(token, response);
            if (!array) return false;
            let [user, _] = array;
            let game = reloadGame(user, response);
            if (!game) return false;
            response.statusCode = 200;
            response.end(game);
            break;
        }
        default: {
            response.statusCode = 404;
            fs.readFile("./front/notfound.html", (err, data) => {
                response.end(data);
            });
        }
    }
}

async function getRanking() {
    let ranking = [];
    const data = await rankingRef.get();
    data.forEach(
        r => ranking.push({"username": r.data()["pseudo"], "points": r.data()["points"], "wins": r.data()["wins"], "games": r.data()["games"], "level": r.data()["level"]})
    )
    ranking.sort((a, b) => b["points"] - a["points"]);
    const topTen = ranking.slice(0, 10);
    return topTen;
}

function managePointsBody(body, response) {
    let email;
    for (const [key, value] of Object.entries(body)) {
        if (key === "username") email = value;
        else return raiseError(response, `Le paramètre ${key} est inconnu ! Veuillez vérifier votre requête.`)
    }
    if (!email) return raiseError(response, `Le paramètre username est manquant ! Veuillez vérifier votre requête.`);
    return email;
}

function getWord(min, max) {
    let index = randomNumber(min, Math.min(max, words.length-1));
    while (!words[index]) index = randomNumber(min, Math.min(max, words.length-1));
    let rd = randomNumber(0, words[index].length-1);
    return words[index][rd];
}

function randomNumber(start, stop) {
    return Math.floor(Math.random()*(stop-start)) + +start;
}

function raiseError(response, message, code=400) {
    response.statusCode = code;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end(message);
    return false;
}

function newGame(params, response, headers) {
    let level = manageNewGameParams(params, response);
    let [min, max] = LEVELS[level];
    let token = getToken(headers, response);
    if (!token) return false;
    let [user, pseudo] = verifyToken(token, response);
    if (!user) return false;
    let game = new Game(getWord(min, max), user, pseudo);

    gameInstances[user] = game;
    return game.newGame();
}

async function testLetter(params, response, headers) {
    let token = getToken(headers, response);
    if (!token) return false;
    let [user, _] = verifyToken(token, response);
    if (!user) return false;
    if (!gameInstances[user]) {
        return raiseError(response, "Aucune partie en cours. Veuillez appeler testLetter !")
    }
    if (params) {
        let letter = manageTestLetterParams(params, response);
        if (letter) {
            let data = await gameInstances[user].testLetter(letter);
            response.statusCode = 200;
            response.end(JSON.stringify(data));
        }
    }

}

function manageTestLetterParams(params, response) {
    if (!params) return raiseError(response, "Il manque le paramètre letter !")
    let splitParams = params.split("&");
    let letter;
    for (let param of splitParams) {
        let [paramName, paramValue] = param.split("=");
        if (paramName === "letter") letter = paramValue;
        else return raiseError(response, `Paramètre ${paramName} inconnu ! Veuillez vérifier votre requête.`);
    }
    if (!/^[A-Z]$/.test(letter)) return raiseError(response, "La lettre doit être un seul caractère majuscule !")
    return letter;
}

function manageNewGameParams(params, response) {
    if (!params) return raiseError(response, "Il manque le paramètre level !")
    let splitParams = params.split("&");
    let level;
    for (let param of splitParams) {
        let [paramName, paramValue] = param.split("=");
        if (paramName === "level") level = paramValue;
        else return raiseError(response, `Paramètre ${paramName} inconnu ! Veuillez vérifier votre requête.`);
    }
    if (!level) return raiseError(response, "Il n'y a pas de paramètre level ! Veuillez vérifier votre requête.")
    if (!LEVELS_NAMES.includes(level)) return raiseError(response, `Le niveau ${level} est inconnu ! Veuillez vérifier votre requête.`)
    return level;
}

function manageGetWordParams(params, response) {
    let splitParams = params.split("&");
    let min = null;
    let max = null;
    for (let param of splitParams) {
        let [paramName, paramValue] = param.split("=");
        switch (paramName) {
            case ("minLetters"): {
                min = paramValue;
                break;
            }
            case ("maxLetters"): {
                max = paramValue;
                break
            }
            default: {
                return raiseError(response, `Paramètre ${paramName} inconnu ! Veuillez vérifier votre requête.`);
            }
        }
    }
    if (!min || !max) {
        return raiseError(response, `Il manque au moins un paramètre (minLetters et/ou maxLetters) ! Veuillez vérifier votre requête.`);
    }
    if (min < 0) return raiseError(response, `Le paramètre minLetters doit être supérieur ou égal à 0 ! Veuillez vérifier votre requête.`);
    if (+max < +min) return raiseError(response, `Le paramètre maxLetters doit être au moins égal au paramètre minLetters ! Veuillez vérifier votre requête.`);
    if (+min >= MAX_LENGTH) return raiseError(response, `Le paramètre minLetters est supérieur à la longueur des plus longs mots ! Veuillez vérifier votre requête.`)
    return [min, max];
}

async function manageSignBody(body, response, verifyEmail=true) {
    let email = null;
    let password = null;
    let pseudo = null;
    for (const [key, value] of Object.entries(body)) {
        switch (key.toString()) {
            case ("username"): {
                email = value;
                break;
            }
            case ("password"): {
                password = value;
                break
            }
            case ("pseudo"): {
                pseudo = value;
                break
            }
            default: {
                return raiseError(response, `Paramètre ${key} inconnu ! Veuillez vérifier votre requête.`);
            }
        }
    }
    if (!email || !password || (verifyEmail && !pseudo)) {
        return raiseError(response, `Il manque au moins un paramètre (email et/ou password) ! Veuillez vérifier votre requête.`);
    }
    if (verifyEmail && await emailExists(email)) return raiseError(response, `Cet email existe déjà ! Veuillez vérifier votre requête`, 418);
    return [email, password];
}

function getToken(headers, response) {
    if (!headers["token"]) return raiseError(response, "Token manquant !", 401);
    return headers["token"];
}

function verifyToken(token, response) {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded) return raiseError(response, "Token invalide !", 401);
    return [decoded["email"], decoded["pseudo"]];
}

async function emailExists(email) {
    const snapshot = await usersRef.where('email', '==', email).get();
    return !snapshot.empty;
}

async function findPassword(email, response) {
    let password;
    const snapshot = await usersRef.where('email', '==', email).get();
    if (snapshot.empty) return raiseError(response, "Email inconnu !", 418);
    snapshot.forEach(
        r => password = r.data()["password"]
    )
    return password;
}



async function signin(e, p, response) {
    let hashedPassword = await findPassword(e);
    if (!hashedPassword) return false;
    let ps;

    let snapshot = await usersRef.where("email", "==", e).get();
    snapshot.forEach(
        r => ps = r.data()["pseudo"]
    )


    bcrypt.compare(p, hashedPassword, (err, result) => {
        if (err) return raiseError(response, err.statusText)
        if (!result) {
            return raiseError(response, "Mot de passe incorrect !", 401);
        }
        response.statusCode = 200;
        const token    = jwt.sign({
                email: e,
                pseudo: ps
            },
            process.env.JWT_SECRET,
            {
                expiresIn: 86400
            });
        response.end(token);
    })
}

async function signup(e, p, pseu) {

    const salt = await new Promise((resolve, reject) => {
        bcrypt.genSalt(10, function(err, salt) {
            if (err) reject(err);
            resolve(salt);
        });
    });

    const hash = await new Promise((resolve, reject) => {
        bcrypt.hash(p, salt, function(err, hash) {
            if (err) reject(err);
            resolve(hash);
        });
    });

    const uuid = uuidv4();

    const emailData = {
        email: e,
        password: hash,
        pseudo: pseu
    };

    const rankingData = {
        email: e,
        points: 0,
        pseudo: pseu,
        games: 0,
        wins: 0,
        level: 1
    }

    const ref = await usersRef.doc(uuid).set(emailData);
    const ref2 = await rankingRef.doc(uuid).set(rankingData);
    return ref;
}

async function getPoints(email, response) {
    let points = 0;
    const snapshot = await rankingRef.where('email', '==', email).get();
    if (snapshot.empty) return raiseError(response, "Aucun record enregistré !")
    snapshot.forEach(
            r => {
                points = r.data()["points"];
            }
        )
    return points;
}



class Game {
    constructor(word, user, pseudo) {
        this.word = word.toUpperCase();
        this.length = word.length;
        this.errors = 0;
        this.wordArray = Array.from({length: this.length}, () => '_')
        this.points = 0;
        this.user = user;
        this.pseudo = pseudo;
        this.goodLetters = [];
        this.badLetters = []
    }

    newGame() {
        return JSON.stringify({"wordLength": this.length})
    }

    async testLetter(checkedLetter) {
        let array = this.wordArray;
        let returnData = {"letter": checkedLetter};
        let positions = [];
        let modified = false;
        let event_type="";
        let won = false;
        for (let [index, l] of Array.from(this.word).entries()) {
            if (checkedLetter === l) {
                array[index] = l;
                modified = true;
                positions.push(index);
            }
        }
        returnData["isCorrect"] = modified;
        this.wordArray = array;
        if (!modified) {
            this.errors++;
            returnData["errors"] = this.errors;
            event_type="BAD_LETTER";
            this.badLetters.push(checkedLetter);
        }
        else {
            returnData["positions"] = positions;
            event_type="GOOD_LETTER";
            this.goodLetters.push(checkedLetter);
        }
        if (this.errors >= MAX_ERRORS) {
            returnData["isGameOver"] = true;
            returnData["word"] = this.word;
        }
        else {
            if (this.isWordFound(array)) {
                returnData["isGameOver"] = true;
                event_type="FIND_WORD";
                won=true;
            }
            else {
                returnData["isGameOver"] = false;
            }
        }
        this.points += EVENT_POINTS[event_type];
        if (returnData["isGameOver"]) {
            let level = await this.endGame(won);
            if (level) returnData["level"] = level;

        }
        return returnData;
    }

    isWordFound(array) {
        return array.every(letter => letter!=="_")
    }

    endGame(hasWon) {
        let points = Math.max(this.points, 0);
        delete gameInstances[this.user];

        return this.changePoints(this.user, points, hasWon).then(updatedPoints => {
            return updatedPoints;
        });
    }

    async changePoints(email, points, hasWon) {
        let nowPoints = 0;
        let games = 0;
        let wins = 0;
        let level = 0;
        let id;
        let levelChanged=false;
        const snapshot = await rankingRef.where('email', '==', email).get();
        if (!snapshot.empty) {
            snapshot.forEach(
                r => {
                    nowPoints = r.data()["points"];
                    id = r.id;
                    games = r.data()["games"];
                    wins = r.data()["wins"];
                    level = r.data()["level"]
                }
            )
        }
        console.log(Math.floor((points + nowPoints)/100));
        console.log(Math.floor(nowPoints/100));
        if (hasWon && Math.floor((points + nowPoints)/100) > Math.floor(nowPoints/100)) {
            level++;
            levelChanged=true;
        }
        if (hasWon) {
            wins++;
        }
        const data = {
            "email": email,
            "points": points + nowPoints,
            "pseudo": this.pseudo,
            "games": ++games,
            "wins": wins,
            "level": level
        }
        if (!id) id = uuidv4();
        await rankingRef.doc(id).set(data);
        if (levelChanged) return level;
    }

    reload() {
        return JSON.stringify({
            "wordLength": this.length,
            "nbErrors": this.errors,
            "correctLetters": this.wordArray,
            "incorrectLetters": this.badLetters
        })
    }
}

function reloadGame(email, response) {
    let game;
    if (gameInstances[email]) game = gameInstances[email];
    if (!game) return raiseError(response, "Aucune partie en cours !");
    return game.reload();
}

exports.manage = manageRequest;