const API_URL = "https://script.google.com/macros/s/AKfycbzXCQcCXIxhDG3vOhAiUGC-ltfJ8sfwo-_QSXuLuA9yQkp6H3JA1Kc4aL1sTPlE_wEk4A/exec";

const READ_TIMEOUT_MS = 15000;
const WRITE_TIMEOUT_MS = 20000;
const CACHE_TTL_MS = 60000;

const requestCache = {
    summary: { data: null, updatedAt: 0 },
    report: { data: null, updatedAt: 0 },
    search: new Map()
};

const inFlight = {
    summary: false,
    report: false,
    searchController: null,
    checkIn: new Set()
};

const ui = {};
let checkInModalInstance = null;
let backdropRequestCount = 0;

function initUiRefs() {
    ui.backdrop = document.getElementById('backdrop');
    ui.accessTokenField = document.querySelector('#accessToken');
    ui.checkInModal = document.getElementById('checkInModal');
    ui.checkInModalMessage = document.getElementById('checkInModalMessage');
    ui.searchInput = document.getElementById('searchInput');
    ui.searchBtn = document.getElementById('searchBtn');
    ui.details = document.getElementById('details');
    ui.reportTable = document.getElementById('reportTable');
    ui.reportUpdatedAt = document.getElementById('reportUpdatedAt');
    ui.summaryUpdatedAt = document.getElementById('summaryUpdatedAt');
    ui.reportStatus = document.getElementById('reportStatus');
    ui.summaryStatus = document.getElementById('summaryStatus');
}

function getCheckInModal() {
    if (!checkInModalInstance && ui.checkInModal) {
        checkInModalInstance = new bootstrap.Modal(ui.checkInModal);
    }
    return checkInModalInstance;
}

function showModalMessage(message, isSuccess) {
    ui.checkInModalMessage.innerText = message;
    ui.checkInModalMessage.className = isSuccess ? 'text-success' : 'text-danger';
    const modal = getCheckInModal();
    if (modal) {
        modal.show();
    }
}

function showBackdrop() {
    backdropRequestCount += 1;
    if (ui.backdrop) {
        ui.backdrop.style.display = 'flex';
    }
}

function hideBackdrop() {
    backdropRequestCount = Math.max(0, backdropRequestCount - 1);
    if (backdropRequestCount === 0 && ui.backdrop) {
        ui.backdrop.style.display = 'none';
    }
}

function isCacheFresh(updatedAt) {
    return updatedAt > 0 && (Date.now() - updatedAt) <= CACHE_TTL_MS;
}

function formatTime(timestamp) {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function setUpdatedAt(type, updatedAt) {
    const label = `Last updated: ${formatTime(updatedAt)}`;
    if (type === 'summary' && ui.summaryUpdatedAt) {
        ui.summaryUpdatedAt.innerText = label;
    }
    if (type === 'report' && ui.reportUpdatedAt) {
        ui.reportUpdatedAt.innerText = label;
    }
}

function setStatusMessage(type, message, className) {
    const target = type === 'summary' ? ui.summaryStatus : ui.reportStatus;
    if (!target) {
        return;
    }
    target.innerText = message || '';
    target.className = className || '';
}

function setSearchLoading(isLoading) {
    if (!ui.searchBtn) {
        return;
    }
    ui.searchBtn.disabled = isLoading;
    ui.searchBtn.innerText = isLoading ? 'Searching...' : 'Search';
}

function appendDetailsMessage(message, className) {
    ui.details.innerHTML = `<p class="${className}">${message}</p>`;
}

async function fetchJsonWithTimeout(url, options = {}) {
    const { timeoutMs = READ_TIMEOUT_MS, retries = 0, signal } = options;
    let attempt = 0;

    while (attempt <= retries) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        let abortHandler = null;

        if (signal) {
            abortHandler = () => controller.abort();
            signal.addEventListener('abort', abortHandler);
        }

        try {
            const response = await fetch(url, { signal: controller.signal });
            return await response.json();
        } catch (error) {
            const isLastAttempt = attempt >= retries;
            if (isLastAttempt) {
                throw error;
            }
        } finally {
            clearTimeout(timeoutId);
            if (signal && abortHandler) {
                signal.removeEventListener('abort', abortHandler);
            }
        }

        attempt += 1;
    }
}

function renderSummaryCards(data) {
    document.getElementById('totalUPI').innerText = `\u20B9${data.totalUPI || 0}`;
    document.getElementById('totalCash').innerText = `\u20B9${data.totalCash || 0}`;
    document.getElementById('totalAmount').innerText = `\u20B9${data.totalAmount || 0}`;
}

// Fetch and display payment summary
async function checkedInSummary(forceRefresh = false) {
    const authToken = (ui.accessTokenField && ui.accessTokenField.value) || '';
    if (!authToken || inFlight.summary) {
        return;
    }

    const cached = requestCache.summary;
    if (!forceRefresh && cached.data) {
        renderSummaryCards(cached.data);
        setUpdatedAt('summary', cached.updatedAt);
        if (isCacheFresh(cached.updatedAt)) {
            setStatusMessage('summary', 'Showing recent data', 'small text-muted');
            return;
        }
        setStatusMessage('summary', 'Refreshing summary...', 'small text-muted');
    }

    inFlight.summary = true;
    showBackdrop();

    try {
        const result = await fetchJsonWithTimeout(`${API_URL}?action=checkedInSummary&authToken=${authToken}`, {
            timeoutMs: READ_TIMEOUT_MS,
            retries: 1
        });
        const status = (result.status || '').toLowerCase();
        if (status === 'success') {
            const updatedAt = Date.now();
            requestCache.summary = { data: result.data || {}, updatedAt };
            renderSummaryCards(result.data || {});
            setUpdatedAt('summary', updatedAt);
            setStatusMessage('summary', 'Data updated', 'small text-success');
        } else {
            setStatusMessage('summary', '', '');
            showModalMessage(result.message || 'Failed to load summary data.', false);
        }
    } catch (error) {
        console.log(error);
        if (cached.data) {
            renderSummaryCards(cached.data);
            setStatusMessage('summary', 'Could not refresh. Showing last available data.', 'small text-warning');
        } else {
            setStatusMessage('summary', '', '');
            showModalMessage('Error retrieving summary data', false);
        }
    } finally {
        inFlight.summary = false;
        hideBackdrop();
    }
}

// List all students for the Report tab
async function listStudents(forceRefresh = false) {
    const authToken = (ui.accessTokenField && ui.accessTokenField.value) || '';
    if (!authToken || inFlight.report) {
        return;
    }

    const cached = requestCache.report;
    if (!forceRefresh && cached.data) {
        listStudentDetails(cached.data);
        setUpdatedAt('report', cached.updatedAt);
        if (isCacheFresh(cached.updatedAt)) {
            setStatusMessage('report', 'Showing recent data', 'small text-muted');
            return;
        }
        setStatusMessage('report', 'Refreshing report...', 'small text-muted');
    }

    inFlight.report = true;
    showBackdrop();

    try {
        const result = await fetchJsonWithTimeout(`${API_URL}?action=listStudentDetails&authToken=${authToken}`, {
            timeoutMs: READ_TIMEOUT_MS,
            retries: 1
        });
        const status = (result.status || '').toLowerCase();
        if (status === 'success') {
            const updatedAt = Date.now();
            const data = Array.isArray(result.data) ? result.data : [];
            requestCache.report = { data, updatedAt };
            listStudentDetails(data);
            setUpdatedAt('report', updatedAt);
            setStatusMessage('report', 'Data updated', 'small text-success');
        } else {
            ui.reportTable.innerHTML = `<p class='text-danger'>${result.message || 'Failed to load data.'}</p>`;
            setStatusMessage('report', '', '');
        }
    } catch (error) {
        console.log(error);
        if (cached.data) {
            listStudentDetails(cached.data);
            setStatusMessage('report', 'Could not refresh. Showing last available data.', 'small text-warning');
        } else {
            ui.reportTable.innerHTML = `<p class='text-danger'>Error retrieving data</p>`;
            setStatusMessage('report', '', '');
        }
    } finally {
        inFlight.report = false;
        hideBackdrop();
    }
}

// Render student list as a table in the Report tab
function listStudentDetails(details) {
    if (!details || details.length === 0) {
        document.getElementById('reportTable').innerHTML = '<p class="text-danger">No records found.</p>';
        return;
    }

    // Destroy existing DataTable if it exists
    if ($.fn.DataTable.isDataTable('#studentTable')) {
        $('#studentTable').DataTable().destroy();
    }

    let table = `<div class="table-responsive"><table id="studentTable" class="table table-bordered table-striped">
        <thead class="table-light">
            <tr>
                <th>#</th>
                <th>Name</th>
                <th>Reg No</th>
                <th>Role</th>
                <th>Amount to be Paid</th>
                <th>Center</th>
                <th>Service</th>
                <th>Department</th>
                <th>Mobile Number</th>
                <th>Bus Required</th>
                <th>Food Preference</th>
                <th>Payment Status</th>
                <th>Payment Received By</th>
            </tr>
        </thead>
        <tbody>`;
    details.forEach((detail, idx) => {
        table += `<tr>
            <td>${idx + 1}</td>
            <td>${detail.name || ''}</td>
            <td>${detail.regRefNo || ''}</td>
            <td>${detail.role || ''}</td>
            <td>${detail.reg_amount || ''}</td>
            <td>${detail.center || ''}</td>
            <td>${detail.service || ''}</td>
            <td>${detail.department || ''}</td>
            <td>${detail.mobileNumber || ''}</td>
            <td>${detail.busRequired || ''}</td>
            <td>${detail.foodPreference || ''}</td>
            <td>${detail.paymentStatus || ''}</td>
            <td>${detail.paymentReceivedBy || ''}</td>
        </tr>`;
    });
    table += '</tbody></table></div>';
    document.getElementById('reportTable').innerHTML = table;

    // Initialize DataTable with search, pagination and CSV export
    $('#studentTable').DataTable({
        dom: 'Bfrtip',
        buttons: [
            {
                extend: 'csv',
                text: 'Download CSV',
                className: 'btn btn-primary',
                filename: 'KidsRetreat2025_Students_' + new Date().toISOString().split('T')[0],
                exportOptions: {
                    columns: [1,2,3,4,5,6,7,8,9,10] // Skip the # column
                }
            }
        ],
        deferRender: true,
        pageLength: 50,
        order: [[2, 'asc']], // Sort by Name column by default
        search: {
            return: true
        },
        language: {
            search: "Search all columns:"
        }
    });
}

function toggleKeyboardType() {
    const input = document.getElementById('searchInput');
    input.type = input.type === 'tel' ? 'text' : 'tel';
    input.focus()
}

function setInputType(type) {
    const input = document.getElementById("searchInput");
    input.type = type; // Change input type
    if (type == "tel") {
        input.placeholder = "Enter Leader/Parent Mobile No or Reg Ref No"
    }
    else {
        input.placeholder = "Enter Student/Leader Name"
    }
}

function fetchStudentDetails() {
    const input = (ui.searchInput && ui.searchInput.value ? ui.searchInput.value : '').trim();
    const authToken = (ui.accessTokenField && ui.accessTokenField.value) || '';

    if (!input) {
        appendDetailsMessage('Please enter a value to search.', 'text-danger mt-3');
        return;
    }

    if (!authToken) {
        appendDetailsMessage('Authentication not ready. Please wait and try again.', 'text-danger mt-3');
        return;
    }

    const cacheKey = `${ui.searchInput.type}:${input.toLowerCase()}`;
    const cached = requestCache.search.get(cacheKey);
    if (cached && isCacheFresh(cached.updatedAt)) {
        displayStudentDetails(cached.data);
        return;
    }

    if (inFlight.searchController) {
        inFlight.searchController.abort();
    }

    const searchController = new AbortController();
    inFlight.searchController = searchController;

    setSearchLoading(true);
    appendDetailsMessage('Searching...', 'text-muted mt-3');

    fetchJsonWithTimeout(`${API_URL}?action=getStudentDetails&input=${input}&authToken=${authToken}`, {
        timeoutMs: READ_TIMEOUT_MS,
        retries: 1,
        signal: searchController.signal
    })
        .then(result => {
            const status = (result.status || '').toLowerCase();
            if (status === 'success') {
                const data = Array.isArray(result.data) ? result.data : [];
                requestCache.search.set(cacheKey, { data, updatedAt: Date.now() });
                displayStudentDetails(data);
            } else {
                showModalMessage(result.message || 'No data found.', false);
                appendDetailsMessage(result.message || 'No records found.', 'text-danger mt-3');
            }
        })
        .catch((error) => {
            if (error && error.name === 'AbortError') {
                return;
            }
            console.log(error);
            showModalMessage('Error retrieving data', false);
            appendDetailsMessage('Error retrieving data', 'text-danger mt-3');
        })
        .finally(() => {
            if (inFlight.searchController === searchController) {
                inFlight.searchController = null;
            }
            setSearchLoading(false);
        });
}

// store payment status per regRefNo
let paymentStatusMap = {};

function displayStudentDetails(details) {
    let content = '';
    if (details.length > 0) {
        details.forEach(detail => {
            // use detail.paymentStatus if available, else ""
            const paymentStatus = detail.paymentStatus || "";
            const paymentModeValue = (detail.paymentMode || '').toUpperCase();
            const foodPreference = detail.foodPreference || '';
            const paymentReceivedBy = detail.paymentReceivedBy || '';
            const tokenIssuedBy = detail.tokenIssuedBy || '';
            const regAmount = detail.reg_amount || '';

            // initialize map
            paymentStatusMap[detail.rowNo] = paymentStatus;

            content += `<div class="card mt-3">
              <div class="card-body">
                <h5>Name: ${detail.name}</h5>
                <p><strong>Reg No:</strong> ${detail.regRefNo}</p>
                <p><strong>Role:</strong> ${detail.role}</p>
                <p><strong>Payment Mode:</strong> ${detail.paymentMode}</p>
                <p><strong>Center:</strong> ${detail.center}</p>
                <p><strong>Department:</strong> ${detail.department}</p>
                <p><strong>MobileNumber:</strong> ${detail.mobileNumber}</p>
                <p><strong>Bus Required:</strong> ${detail.busRequired}</p>
                <p><strong>Reg Amount:</strong> ${regAmount}</p>
                <p class="${foodPreference.toString().toLowerCase()}">
                    <strong>Food Preference:</strong> ${foodPreference}
                </p>

                <p>
                    Payment Mode:
                    <input type="radio"
                           name="paymentMode${detail.rowNo}"
                           onchange="updatePaymentStatus('${detail.rowNo}', this.value)"
                           value="UPI"
                              ${paymentModeValue !== "" ? "disabled" : ""}
                              ${paymentModeValue === "UPI" ? "checked" : ""}>
                    <label for="paymentMode${detail.rowNo}UPI">UPI</label>

                    <input type="radio"
                           name="paymentMode${detail.rowNo}"
                           onchange="updatePaymentStatus('${detail.rowNo}', this.value)"
                           value="CASH"
                              ${paymentModeValue !== "" ? "disabled" : ""}
                              ${paymentModeValue === "CASH" ? "checked" : ""}>
                    <label for="paymentMode${detail.rowNo}CASH">CASH</label>
                </p>

                <p>
                    Payment Received:
                    <span class="${paymentStatus.toLowerCase()}" id="paid${detail.rowNo}">
                        ${paymentStatus || "Not Paid"}
                    </span>
                </p>
                <p>
                    Payment Received By:
                    <span id="payment_received_by${detail.rowNo}">${paymentReceivedBy}</span>
                </p>
                <p>
                    Token Issued By:
                    <span id="token_issued${detail.rowNo}">${tokenIssuedBy}</span>
                </p>

                <button class="btn btn-primary"
                        onclick="checkIn('${detail.rowNo}', 'paid')"> Payment Received
                </button>
                <button class="btn btn-primary issue-token-btn"
                        onclick="checkIn('${detail.rowNo}', 'token_issued')"
                        ${paymentStatus === "" ? "disabled" : ""}>Issue Token</button>
              </div>
            </div>`;
        });
    } else {
        content = '<p class="text-danger mt-3">Record not found</p>';
    }
    document.getElementById('details').innerHTML = content;
}

// global function
function updatePaymentStatus(regRefNo, value) {
    const normalized = value.toUpperCase() === "UPI" ? "UPI" : "CASH";
    paymentStatusMap[regRefNo] = normalized;

    console.log(`Payment status for ${regRefNo} updated to: ${normalized}`);

    // update display span
    document.getElementById(`paid${regRefNo}`).innerText = normalized;
}

// checkIn with validation
function checkIn(regRefNo, status) {
    const paymentMode = paymentStatusMap[regRefNo] || "";
    const actionKey = `${regRefNo}:${status}`;
    if (inFlight.checkIn.has(actionKey)) {
        return;
    }

    const clickedButton = (window.event && window.event.currentTarget) ? window.event.currentTarget : null;
    const card = clickedButton ? clickedButton.closest('.card-body') : null;
    const issueTokenBtn = card ? card.querySelector('.issue-token-btn') : null;


    if (!paymentMode) {
        alert("Please select a payment mode before continuing.");
        return;
    }

    inFlight.checkIn.add(actionKey);
    if (clickedButton) {
        clickedButton.disabled = true;
    }

    showBackdrop();
    let statusTextMap = {
        'paid': 'Payment Received',
        'token_issued': 'Token Issued',
    };
    const authToken = (ui.accessTokenField && ui.accessTokenField.value) || '';

    fetchJsonWithTimeout(`${API_URL}?action=checkInStudent&regRefNo=${regRefNo}&status=${status}&paymentMode=${paymentMode}&authToken=${authToken}`, {
        timeoutMs: WRITE_TIMEOUT_MS,
        retries: 0
    })
        .then(result => {
            const statusValue = (result.status || '').toLowerCase();
            const statusTargetId = status === 'paid' ? `paid${regRefNo}` : `token_issued${regRefNo}`;

            if (statusValue === 'success') {
                const statusTarget = document.getElementById(statusTargetId);
                if (statusTarget) {
                    statusTarget.innerText = 'YES';
                }
                showModalMessage(`${statusTextMap[status]} successful!`, true);
                if (status === 'paid' && issueTokenBtn) {
                    issueTokenBtn.disabled = false;
                }
            } else {
                showModalMessage(`${statusTextMap[status]} failed. Please try again.`, false);
            }
        })
        .catch(() => {
            showModalMessage(`Error during ${statusTextMap[status]}. Please try again.`, false);
        })
        .finally(() => {
            inFlight.checkIn.delete(actionKey);
            if (clickedButton) {
                clickedButton.disabled = false;
            }
            hideBackdrop();
        });
}


function login() {
    console.log(auth0)
    auth0.createAuth0Client({
        domain: "dev-sazlz3uf0genwd7a.us.auth0.com",
        clientId: "APU6p14IiXfP3Q83B1c8VvPy4cZ2YAH9",
        authorizationParams: {
            redirect_uri: window.location.origin + "/ss-events/index.html"
        }
    }).then(async (auth0Client) => {

        console.log(auth0Client)


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


        // Assumes an element with id "profile" in the DOM
        const profileElement = document.getElementById("profile");

        if (isAuthenticated) {
            const userProfile = await auth0Client.getUser();
            logoutButton.style.display = "block";
            profileElement.style.display = "block";
            profileElement.innerHTML = `
            <p style="margin: 0 3px 0px 0px;">${userProfile.name}</p>
            <img alt="User Icon" class="rounded-circle me-2"
            style="width: 40px; height: 40px;" src="${userProfile.picture}" />
        `;
        } else {
            //auth0Client.logout();
            profileElement.style.display = "none";
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
}

window.addEventListener("load", (event) => {
    console.log("page is fully loaded");
    initUiRefs();

    if (ui.searchInput) {
        ui.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                fetchStudentDetails();
            }
        });
    }

    login();
});