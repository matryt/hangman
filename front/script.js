let elementsToReveal = [
    document.querySelector("#letters"),
    document.querySelector("#displayWord"),
    document.querySelector("#pendu"),
    document.querySelector("#restart")
];
let playButton = document.querySelector("#play");
let hangmanElements = document.querySelectorAll(".hangmanElement");
let wordDisplayArea = document.querySelector("#displayWord");
let letterSpansArray = document.querySelectorAll("#letters span");
let resetButton = document.querySelector("#restart");
let basement = document.querySelector("#basement");
let pillar = document.querySelector("#pillar");
let accounts = document.querySelector("#accounts");
let signup = document.querySelector("#signup");
let signin = document.querySelector("#signin");
let logout = document.querySelector("#logout");
let mailAreaSignUp = document.querySelector("#email");
let passwordAreaSignUp = document.querySelector("#password");
let pseudoAreaSignUp = document.querySelector("#pseudo");
let mailAreaSignin = document.querySelector("#email2");
let passwordAreaSignin = document.querySelector("#password2");
let continueGame = document.querySelector("#resetGame");
let displayArea = document.querySelector("#displayMessages");
let messageType = document.querySelector("#displayMessages div p:nth-child(1)");
let messageData = document.querySelector("#displayMessages div p:nth-child(2)");
let emojiMessage = document.querySelector("#displayMessages div:first-child");
let requirements = document.querySelectorAll("#requirements ol li");
let spans = [requirements[0].querySelector("span"), requirements[1].querySelector("span"), requirements[2].querySelector("span")];
let revealPasswords = document.querySelectorAll(".reveal");
let darkModeButton = document.querySelector("#darkMode");
let body = document.querySelector("body");
let levelChoice = document.querySelector("#gameLevels");
let rankingButton = document.querySelector("#ranking");

let errors = 0;
let displayedWord = "";
let wordLength = 0;
const maxErrors = 7;
let token = "";
let letterInfos = false;
let gameOver = false;
let wordArray = [];
let badArray = [];

function resetLetters() {
    for (let i = 0; i < 26; i++) {
        letterSpansArray[i].innerHTML = `&#${i+65};`;
        letterSpansArray[i].classList = "";
    }
}

function hideElements() {
    for (let element of elementsToReveal) {
        element.classList.remove("notDisplayed");
    }
    for (let element of hangmanElements) {
        element.classList.add("notDisplayed");
    }
}

async function getNewGame() {
    let data;
    try {
        displayMessageBox("OK", "Chargement...");
        let level = levelChoice.querySelector("select").value;
        let response = await fetch(`http://localhost:${process.env.PORT}/api/newGame?level=${level}`, {
            headers: {
                "token": token
            },
        });
        if (!response.ok) {
            console.error("Bad response from the server !");
            return;
        }
        data = JSON.parse(await response.json());
    } catch (e) {
        console.error(e);
        return;
    }
    return data["wordLength"];
}

async function initializeVariables() {
    errors = 0;
    wordLength = await getNewGame();
    resetLetters();
    wordArray = [];
    for (let i = 0; i < wordLength; i++) {
        wordArray[i] = "_";
    }
}

async function newGame() {
    hideElements();
    await initializeVariables();
    playButton.classList.add("notDisplayed");
    continueGame.classList.add("notDisplayed");
    displayWord();
    logout.classList="";
}

async function getLetterInfos(letter) {
    let url = `http://localhost:${process.env.PORT}/api/testLetter?letter=` + letter.innerText;
    let data;
    let returnData = [null, null];
    try {
        let response = await fetch(url, {
            headers: {
                "token": token
            },
        });
        if (!response.ok) {
            console.error("Bad response from the server !");
            return returnData;
        }
        data = await response.json();
    } catch (e) {
        console.error(e);
        return returnData;
    }
    if (data["isGameOver"]) {
        gameOver = true;
        displayedWord = data["word"];
        if (data["level"] && numIs(data["level"])) {
            displayMessageBox("OK", `Bravo ! Vous êtes passé au niveau ${data["level"]} !`)
        }
    }
    returnData[0] = data["isCorrect"];
    if (!data["isCorrect"]) errors = data["errors"];
    else returnData[1] = data["positions"];
    return returnData;
}

function numIs(a) {
    return (!isNaN(parseFloat(a)) && isFinite(a));
}

async function checkLetter(letter) {
    if (!isWordFound() && errors <= maxErrors && !(letter.classList.contains("ok") || letter.classList.contains("ko"))) {
        letterInfos = await getLetterInfos(letter);
        if (letterInfos[0] != null && errors <= maxErrors && !isWordFound()) {
            if (letterInfos[0]) {
                for (let index of letterInfos[1]) {
                    wordArray[index] = letter.innerText;
                }
                letter.innerHTML="&#10003;";
                letter.classList.toggle("ok");
            }
            else {
                displayHangmanPart(errors-1);
                letter.innerHTML = "&#128500;";
                letter.classList.toggle("ko");
            }
            if (isWordFound()) {
                wordDisplayArea.innerText = "You won ! ";
            }
            else {
                displayWord();
            }
        }
        if (errors >= maxErrors) lose();
    }
}

function displayHangmanPart(index) {
    hangmanElements[index].classList.toggle("notDisplayed");
}

function isWordFound() {
    return !(wordArray.includes("_"));
}

function displayWord() {
    let wordToDisplay = "";
    for (let letter of wordArray) {
        if (letter === "") letter = "_"
        wordToDisplay += letter;
        wordToDisplay += " ";
    }
    wordDisplayArea.innerText = wordToDisplay;
}

async function resetGame() {
    displayMessageBox("OK", "Chargement...");
    letterSpansArray.forEach((letter) => letter.className="");
    hideElements();
    await initializeVariables();
    displayWord();
}

function lose() {
    wordDisplayArea.innerHTML = "You lost ! The mystery word was " +displayedWord;
}

function handleResize() {
    if (innerWidth < 750) {
        basement.setAttribute("y1", "230");
        basement.setAttribute("y2", "230");
        pillar.setAttribute("y1", "230");
        basement.style.strokeWidth = "7px";
    }
    else {
        basement.setAttribute("y1", "250");
        basement.setAttribute("y2", "250");
        pillar.setAttribute("y1", "250");
        basement.style.strokeWidth = "3px";
    }
}

async function handleSignUp() {
    let bodyDict = {
        "username": mailAreaSignUp.value,
        "pseudo": pseudoAreaSignUp.value,
        "password": passwordAreaSignUp.value
    };
    try {
        if (!(verifyPassword())) {
            displayMessageBox("Erreur", "Le mot de passe ne respecte pas les conditions");
            return;
        }
        if (!(validateEmail(mailAreaSignUp.value))) {
            displayMessageBox("Erreur", "L'adresse mail est invalide !");
            return;
        }
        let response = await fetch(`http://localhost:${process.env.PORT}/api/signup`, {
            method: "POST",
            body: JSON.stringify(bodyDict),
            headers: {
                "Content-Type": "application/json"
            }
        });
        if (response.status === 201) {
            displayMessageBox("OK", "Inscription prise en compte !");
        }
        else {
            displayMessageBox("Erreur", "Un compte avec cette adresse mail existe déjà !");
        }
    } catch (e) {
        console.error(e);
    }
}

function removeErrors() {
    displayArea.classList.add("notDisplayed");
}

async function handleLogin() {
    let bodyDict = {
        "username": mailAreaSignin.value,
        "password": passwordAreaSignin.value
    };
    try {
        let response = await fetch(`http://localhost:${process.env.PORT}/api/signin`, {
            method: "POST",
            body: JSON.stringify(bodyDict)
        })
        ;
        if (response.status === 401) {
            displayMessageBox("Erreur", "Couple identifiant/mot de passe incorrect !");
        }
        else if (response.status === 418) {
            displayMessageBox("Erreur", "Utilisateur inconnu !");
        }
        else {
            token = await response.text();
            displayMessageBox("OK", "Connecté !");
            displayHome();
            localStorage.setItem("token", token);
            logout.classList.remove("notDisplayed");
        }
    } catch (e) {
        console.error(e);
    }
}

function displayHome() {
    accounts.classList.add("notDisplayed");
    playButton.classList.remove("notDisplayed");
    continueGame.classList.remove("notDisplayed");
    levelChoice.classList.remove("notDisplayed");
    rankingButton.classList.remove("notDisplayed");
}

async function reloadGame() {
    try {
        let response = await fetch(`http://localhost:${process.env.PORT}/api/gameState`, {
            headers: {
                "token": token
            },
        });
        if (response.status === 200) {
            let json = await response.json();
            errors = json["nbErrors"];
            wordLength = json["wordLength"];
            wordArray = json["correctLetters"];
            badArray = json["incorrectLetters"];
            hideElements();
            playButton.classList.add("notDisplayed");
            continueGame.classList.add("notDisplayed");
            resetVariablesPrevious();
            logout.classList.remove("notDisplayed");
        }
        else {
            displayMessageBox("Erreur", "Aucune partie en cours !");
        }
    } catch (e) {
        console.error(e);
    }
}

function resetVariablesPrevious() {
    displayWord();
    for (let i = 0; i < errors ; i++) {
        displayHangmanPart(i);
    }
    for (let letter of wordArray) {
        if (letter !== "_") {
            let span = letterSpansArray[letter.charCodeAt(0)-65];
            span.innerHTML="&#10003;";
            span.classList.add("ok");
        }

    }
    for (let letter of badArray) {
        let span = letterSpansArray[letter.charCodeAt(0)-65];
        span.innerHTML = "&#128500;";
        span.classList.add("ko");
    }

}

function getExpirationTime(token) {
    let base64Url = token.split('.')[1];
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    let jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload)["exp"];
}

function verifyLogin() {
    let token_test = localStorage.getItem("token");
    if (token_test && getExpirationTime(token_test)*1000 >= Date.now()) {
        token = token_test;
        displayHome();
        logout.classList.remove("notDisplayed");
    }
}

function toggleDarkMode() {
    if (body.classList.contains("dark")) {
        darkModeButton.innerText="Dark mode";
        body.classList.remove("dark");
    }
    else {
        darkModeButton.innerText="Light mode";
        body.classList.add("dark");
    }
    verifyPassword();
}

function setEventListeners() {
    playButton.addEventListener("click", async () => await newGame());
    letterSpansArray.forEach(letter => letter.addEventListener("click", async () => await checkLetter(letter)));
    resetButton.addEventListener("click", async() => await resetGame());
    window.addEventListener("resize", handleResize);
    window.addEventListener("load", handleResize);
    signup.addEventListener("click", async() => await handleSignUp());
    signin.addEventListener("click", async () => await handleLogin());
    continueGame.addEventListener("click", async () => await reloadGame());
    logout.addEventListener("click", handleLogout);
    passwordAreaSignUp.addEventListener("input", verifyPassword);
    passwordAreaSignUp.addEventListener("change", verifyPassword);
    revealPasswords[0].addEventListener("click", () => showPassword(revealPasswords[0], passwordAreaSignUp));
    revealPasswords[1].addEventListener("click", () => showPassword(revealPasswords[1], passwordAreaSignin));
    darkModeButton.addEventListener("click", toggleDarkMode)
}

function displayMessageBox(type, message) {
    messageType.innerText = type;
    messageData.innerText = message;
    if (type==="Erreur") {
        emojiMessage.innerHTML = "&#9888;";
        displayArea.style.borderColor="#FF7043";
        displayArea.style.backgroundColor="#FF7043";
    }
    else {
        emojiMessage.innerHTML = "&#10003;";
        displayArea.style.borderColor="#4FC3F7";
        displayArea.style.backgroundColor="#4FC3F7";
    }
    displayArea.classList.remove("notDisplayed");
    setTimeout(removeErrors, 2000);
}

function handleLogout() {
    if (localStorage.getItem("token")) {
        localStorage.removeItem("token");
        token="";
        displayMessageBox("OK", "Déconnexion prise en compte !");
        displayHome();
        for (let element of elementsToReveal) {
            element.classList.add("notDisplayed");
        }
        for (let element of hangmanElements) {
            element.classList.add("notDisplayed");
        }
        logout.classList.add("notDisplayed");
        accounts.classList.remove("notDisplayed");
        playButton.classList.add("notDisplayed");
        continueGame.classList.add("notDisplayed");
        levelChoice.classList.add("notDisplayed");
        rankingButton.classList.add("notDisplayed");
    }

}

function containsLetter(chaine) {
    let regex = /[a-zA-Z]/;
    return regex.test(chaine);
}

function containsNumber(chaine) {
    let regex = /[0-9]/;
    return regex.test(chaine);
}

function verifyPassword() {
    let valid = true;
    let password = passwordAreaSignUp.value;
    if (password.length < 8) {
        spans[0].innerHTML = "&#9888;";
        valid=false;
        requirements[0].style.color="#FF7043";
    }
    else {
        spans[0].innerHTML = "&#10003;";
        requirements[0].style.color=getTextColor();
    }
    if (!containsLetter(password)) {
        spans[1].innerHTML = "&#9888;";
        valid=false;
        requirements[1].style.color="#FF7043";
    }
    else {
        spans[1].innerHTML = "&#10003;";
        requirements[1].style.color=getTextColor();
    }
    if (!containsNumber(password)) {
        spans[2].innerHTML = "&#9888;";
        valid=false;
        requirements[2].style.color="#FF7043";
    }
    else {
        spans[2].innerHTML = "&#10003;";
        requirements[2].style.color=getTextColor();
    }

    return valid;
}

function validateEmail(email) {
    return email.match(
        /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    ) != null;
}

function showPassword(icone, champ) {
    if (champ.type === "password") {
        champ.type = "text";
        icone.querySelector("img").src="openedEye.svg";

    }
    else {
        champ.type = "password";
        icone.querySelector("img").src="closedEye.svg";
    }
}

function getTextColor() {
    if (body.classList.contains("dark")) return "#E1F5FE"
    else return "#0D47A1"
}

setEventListeners();
verifyLogin()