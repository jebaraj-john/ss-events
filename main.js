const API_URL = 'https://script.google.com/macros/s/AKfycbwUMhXBImWs4m9tgn4WR_maBTgYxrbJMZspvrtGITaRLurtJcAV2LSMoFJNlK-hjJQBWg/exec';

function toggleKeyboardType() {
    const input = document.getElementById('searchInput');
    input.type = input.type === 'tel' ? 'text' : 'tel';
    document.getElementById("searchInput").focus()
}

function fetchStudentDetails() {
    let input = document.getElementById('searchInput').value;
    if (input.length < 5 && !input.startsWith("KC")) {
        input = "KC" + input;
    }

    document.getElementById('backdrop').style.display = 'flex';
    const accessTokenField = document.querySelector("#accessToken");
    fetch(`${API_URL}?action=getStudentDetails&input=${input}&authToken=${accessTokenField.value}`)
        .then(response => response.json())
        .then(result => {
            document.getElementById('backdrop').style.display = 'none';
            if (result.status.toLowerCase() === 'success') {
                displayStudentDetails(result.data);
            } else {
                const messageElement = document.getElementById('checkInModalMessage');
                messageElement.innerText = result.message;
                messageElement.className = 'text-danger';
                const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
                modal.show();
            }

        })
        .catch((error) => {
            console.log(error)
            document.getElementById('backdrop').style.display = 'none';
            const messageElement = document.getElementById('checkInModalMessage');
            messageElement.innerText = 'Error retrieving data';
            messageElement.className = 'text-danger';
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
            modal.show();
        });
}

function displayStudentDetails(details) {
    let content = '';
    if (details.length > 0) {
        details.forEach(detail => {
            content += `<div class="card mt-3">
              <div class="card-body">
                <h5>Name: ${detail.name}</h5>
                <p><strong>Reg No:</strong> ${detail.regRefNo}</p>
                <p><strong>Role:</strong> ${detail.role}</p>
                <p><strong>Payment Mode:</strong> ${detail.paymentMode}</p>
                <p><strong>Center:</strong> ${detail.center}</p>
                <p><strong>Service:</strong> ${detail.service}</p>
                <p><strong>Department:</strong> ${detail.department}</p>
                <p>Checked In: <span id="checkedIn${detail.regRefNo}">${detail.checkedIn}</span></p>
                <button class="btn btn-primary" onclick="checkIn('${detail.regRefNo}')">Check In</button>
              </div>
            </div>`;
        });
    } else {
        content = '<p class="text-danger mt-3">Record not found</p>';
    }
    document.getElementById('details').innerHTML = content;
}

function checkIn(regRefNo) {
    document.getElementById('backdrop').style.display = 'flex';

    const accessTokenField = document.querySelector("#accessToken");
    fetch(`${API_URL}?action=checkInStudent&regRefNo=${regRefNo}&authToken=${accessTokenField.value}`)
        .then(response => response.json())
        .then(result => {
            document.getElementById('backdrop').style.display = 'none';

            const messageElement = document.getElementById('checkInModalMessage');
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));

            if (result.status.toLowerCase() === 'success') {
                document.getElementById(`checkedIn${regRefNo}`).innerText = 'YES';
                messageElement.innerText = 'Check-in successful!';
                messageElement.className = 'text-success';
            } else {
                messageElement.innerText = 'Check-in failed. Please try again.';
                messageElement.className = 'text-danger';
            }

            modal.show();
        })
        .catch(() => {
            document.getElementById('backdrop').style.display = 'none';
            const messageElement = document.getElementById('checkInModalMessage');
            messageElement.innerText = 'Error during check-in. Please try again.';
            messageElement.className = 'text-danger';
            const modal = new bootstrap.Modal(document.getElementById('checkInModal'));
            modal.show();
        });
}


auth0.createAuth0Client({
    domain: "dev-sazlz3uf0genwd7a.us.auth0.com",
    clientId: "APU6p14IiXfP3Q83B1c8VvPy4cZ2YAH9",
    authorizationParams: {
        redirect_uri: window.location.origin + "/ss-events/index.html"
    }
}).then(async (auth0Client) => {

// Assumes a button with id "login" in the DOM
// const loginButton = document.querySelector("#loginBtn");

// loginButton.addEventListener("click", (e) => {
//     e.preventDefault();
//     auth0Client.loginWithRedirect();
// });

if (location.search.includes("state=") &&
    (location.search.includes("code=") ||
    location.search.includes("error="))) {
    await auth0Client.handleRedirectCallback();
    window.history.replaceState({}, document.title, "/ss-events");
}

// Assumes a button with id "logout" in the DOM
const logoutButton = document.getElementById("logout");

logoutButton.addEventListener("click", (e) => {
    e.preventDefault();
    //auth0Client.logout();
     auth0Client.logout({
        async onRedirect(url) {
          window.location.replace(url);
        }
      });
    //auth0Client.loginWithRedirect();
});

const isAuthenticated = await auth0Client.isAuthenticated();
//const userProfile = await auth0Client.getUser();

// Assumes an element with id "profile" in the DOM
//const profileElement = document.getElementById("profile");

if (isAuthenticated) {
    logoutButton.style.display = "block";
    //profileElement.style.display = "block";
    // profileElement.innerHTML = `
    //         <p>${userProfile.name}</p>
    //         <img src="${userProfile.picture}" />
    //     `;
} else {
    //profileElement.style.display = "none";
    logoutButton.style.display = "none";
    auth0Client.loginWithRedirect();
}
const accessTokenField = document.querySelector("#accessToken");
const accessToken = await auth0Client.getTokenSilently();
accessTokenField.value = accessToken;

console.log(accessToken)
})
.catch((error) => {
    console.log(error)
});