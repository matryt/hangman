let logout = document.querySelector("#logout");
let ranking = document.querySelector("tbody");
let darkModeButton = document.querySelector("#darkMode");
let body = document.querySelector("body");
let displayArea = document.querySelector("#displayMessages");
let messageType = document.querySelector("#displayMessages div p:nth-child(1)");
let messageData = document.querySelector("#displayMessages div p:nth-child(2)");
let emojiMessage = document.querySelector("#displayMessages div:first-child");

function handleLogout() {
    if (localStorage.getItem("token")) {
        localStorage.removeItem("token");
        displayMessageBox("OK", "Déconnexion prise en compte !");
        window.location.href="http://localhost:8000";
    }
}

async function getRanking() {
    return (await (await fetch("http://localhost:8000/api/ranking")).json());
}

function displayData(data) {
    for (let [index, elem] of Array.from(data).entries()) {
        console.log(elem);
        let tr = document.createElement("tr");
        let td1 = document.createElement("td")
        td1.innerHTML = (index+1).toString();
        let td2 = document.createElement("td")
        td2.innerHTML = elem["username"];
        let td3 = document.createElement("td")
        td3.innerHTML = elem["points"];
        let td4 = document.createElement("td")
        td4.innerHTML = elem["games"];
        let td5 = document.createElement("td")
        td5.innerHTML = elem["wins"];
        let td6 = document.createElement("td")
        td6.innerHTML = elem["level"];
        tr.appendChild(td1);
        tr.appendChild(td2);
        tr.appendChild(td3);
        tr.appendChild(td4);
        tr.appendChild(td5);
        tr.appendChild(td6);
        ranking.appendChild(tr);
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
}

function main() {
    getRanking().then(
        r => {
            console.log()
            displayData(r["ranking"]);
        }
    )
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

function removeErrors() {
    displayArea.classList.add("notDisplayed");
}

logout.addEventListener("click", handleLogout);
darkModeButton.addEventListener("click", toggleDarkMode);
main()
