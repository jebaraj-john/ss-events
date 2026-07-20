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
    ui.summaryPaymentsTable = document.getElementById('summaryPaymentsTable');
    ui.disputeModal = document.getElementById('disputeModal');
    ui.disputeStepQuestion = document.getElementById('disputeStepQuestion');
    ui.disputeStepDetails = document.getElementById('disputeStepDetails');
    ui.disputeRowNo = document.getElementById('disputeRowNo');
    ui.disputeRemarks = document.getElementById('disputeRemarks');
    ui.disputeIssueTokenBtn = document.getElementById('disputeIssueTokenBtn');
    ui.disputePaidModeUpi = document.getElementById('disputePaidModeUPI');
    ui.disputePaidModeCash = document.getElementById('disputePaidModeCASH');
    ui.upiScreenshotProof = document.getElementById('upiScreenshotProof');
    ui.upiScreenshotProofGroup = document.getElementById('upiScreenshotProofGroup');
}

function toggleUpiScreenshotProofVisibility() {
    const isUpiSelected = Boolean(ui.disputePaidModeUpi && ui.disputePaidModeUpi.checked);
    if (ui.upiScreenshotProofGroup) {
        ui.upiScreenshotProofGroup.style.display = isUpiSelected ? 'block' : 'none';
    }
    if (!isUpiSelected && ui.upiScreenshotProof) {
        ui.upiScreenshotProof.checked = false;
    }
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

function getDisputeModal() {
    if (!ui.disputeModal) {
        return null;
    }
    return bootstrap.Modal.getOrCreateInstance(ui.disputeModal);
}

function openPaymentDisputeDialog(rowNo) {
    if (!ui.disputeModal || !ui.disputeRowNo || !ui.disputeStepQuestion || !ui.disputeStepDetails) {
        return;
    }

    ui.disputeRowNo.value = rowNo;
    ui.disputeStepQuestion.style.display = 'block';
    ui.disputeStepDetails.style.display = 'none';
    if (ui.disputeRemarks) {
        ui.disputeRemarks.value = '';
    }
    if (ui.disputeIssueTokenBtn) {
        ui.disputeIssueTokenBtn.style.display = 'none';
    }
    if (ui.disputePaidModeUpi) {
        ui.disputePaidModeUpi.checked = false;
    }
    if (ui.disputePaidModeCash) {
        ui.disputePaidModeCash.checked = false;
    }
    if (ui.upiScreenshotProof) {
        ui.upiScreenshotProof.checked = false;
    }
    toggleUpiScreenshotProofVisibility();

    const modal = getDisputeModal();
    if (modal) {
        modal.show();
    }
}

function handleDisputeAnswer(hasDispute) {
    if (!hasDispute) {
        const modal = getDisputeModal();
        if (modal) {
            modal.hide();
        }
        return;
    }

    if (ui.disputeStepQuestion) {
        ui.disputeStepQuestion.style.display = 'none';
    }
    if (ui.disputeStepDetails) {
        ui.disputeStepDetails.style.display = 'block';
    }
    if (ui.disputeIssueTokenBtn) {
        ui.disputeIssueTokenBtn.style.display = 'inline-block';
    }
    if (ui.disputeRemarks) {
        ui.disputeRemarks.focus();
    }
}

function issueTokenForDispute() {
    const rowNo = ui.disputeRowNo ? ui.disputeRowNo.value : '';
    const remarks = ui.disputeRemarks ? ui.disputeRemarks.value.trim() : '';
    const selectedPaidMode = ui.disputePaidModeUpi && ui.disputePaidModeUpi.checked
        ? 'UPI'
        : (ui.disputePaidModeCash && ui.disputePaidModeCash.checked ? 'CASH' : '');
    const isUpiScreenshotShown = Boolean(ui.upiScreenshotProof && ui.upiScreenshotProof.checked);
    const authToken = (ui.accessTokenField && ui.accessTokenField.value) || '';

    if (!rowNo) {
        return;
    }

    if (!remarks) {
        alert('If user already paid, fill the remarks box.');
        return;
    }

    if (!selectedPaidMode) {
        alert('Please select payment mode paid by user.');
        return;
    }

    if (!authToken) {
        alert('Authentication not ready. Please wait and try again.');
        return;
    }

    const actionKey = `${rowNo}:dispute_token_issued`;
    if (inFlight.checkIn.has(actionKey)) {
        return;
    }

    inFlight.checkIn.add(actionKey);
    if (ui.disputeIssueTokenBtn) {
        ui.disputeIssueTokenBtn.disabled = true;
    }
    showBackdrop();

    const screenshotRemark = selectedPaidMode === 'UPI'
        ? ` | UPI Screenshot Shown: ${isUpiScreenshotShown ? 'Yes' : 'No'}`
        : '';
    const remarksWithMode = `[Paid via ${selectedPaidMode}${screenshotRemark}] ${remarks}`;

    fetchJsonWithTimeout(`${API_URL}?action=checkInStudent&regRefNo=${rowNo}&status=dispute_token_issued&remarks=${encodeURIComponent(remarksWithMode)}&authToken=${authToken}`, {
        timeoutMs: WRITE_TIMEOUT_MS,
        retries: 0
    })
        .then((result) => {
            const statusValue = (result.status || '').toLowerCase();
            if (statusValue !== 'success') {
                showModalMessage('Token issue failed. Please try again.', false);
                return;
            }

            const responseData = result.data || {};
            const tokenIssuedByTarget = document.getElementById(`token_issued${rowNo}`);
            const paymentStatusTarget = document.getElementById(`paid${rowNo}`);
            const actionBtn = document.getElementById(`checkInBtn${rowNo}`);

            if (tokenIssuedByTarget) {
                tokenIssuedByTarget.innerText = responseData.tokenIssuedBy || tokenIssuedByTarget.innerText || '-';
            }

            if (paymentStatusTarget && responseData.paymentStatus) {
                paymentStatusTarget.innerText = responseData.paymentStatus;
            }

            if (actionBtn) {
                actionBtn.disabled = true;
                actionBtn.innerText = 'Check-In Completed';
            }

            const card = actionBtn ? actionBtn.closest('.card-body') : null;
            if (card) {
                const selectedModeInput = card.querySelector(`input[name="paymentMode${rowNo}"]:checked`);
                if (selectedModeInput) {
                    selectedModeInput.disabled = true;
                }
                const unselectedModeInputs = card.querySelectorAll(`input[name="paymentMode${rowNo}"]:not(:checked)`);
                unselectedModeInputs.forEach((input) => {
                    input.disabled = true;
                });
            }

            requestCache.search.clear();
            requestCache.report = { data: null, updatedAt: 0 };
            requestCache.summary = { data: null, updatedAt: 0 };

            const modal = getDisputeModal();
            if (modal) {
                modal.hide();
            }
            showModalMessage('Token issued with dispute remarks.', true);
        })
        .catch(() => {
            showModalMessage('Error while issuing token for dispute.', false);
        })
        .finally(() => {
            inFlight.checkIn.delete(actionKey);
            if (ui.disputeIssueTokenBtn) {
                ui.disputeIssueTokenBtn.disabled = false;
            }
            hideBackdrop();
        });
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

function normalizeBusRequired(value) {
    return (value || '').trim().split(/\s+/)[0] || '';
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

function renderSearchLoadingSkeleton(cardCount = 2) {
    let content = '';

    for (let index = 0; index < cardCount; index++) {
        content += `<div class="card search-result-card search-skeleton-card mt-3">
            <div class="card-body">
                <div class="search-result-top">
                    <div class="w-100">
                        <div class="skeleton-line skeleton-role mb-2"></div>
                        <div class="skeleton-line skeleton-name mb-3"></div>
                        <div class="search-result-pills">
                            <span class="result-pill skeleton-pill"></span>
                            <span class="result-pill skeleton-pill"></span>
                            <span class="result-pill skeleton-pill"></span>
                        </div>
                    </div>
                    <div class="search-result-status">
                        <span class="status-chip skeleton-chip"></span>
                        <span class="status-caption">Loading status</span>
                    </div>
                </div>

                <div class="search-result-grid">
                    <div class="detail-item">
                        <span class="detail-label">Mobile</span>
                        <span class="skeleton-line skeleton-value"></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Bus Required</span>
                        <span class="skeleton-line skeleton-value"></span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Reg Amount</span>
                        <span class="skeleton-line skeleton-value"></span>
                    </div>
                    <div class="detail-item detail-item-wide">
                        <span class="detail-label">Payment / Token By</span>
                        <div class="detail-inline-pair">
                            <span class="detail-inline-block">
                                <span class="detail-inline-key">Payment</span>
                                <span class="skeleton-line skeleton-value skeleton-inline"></span>
                            </span>
                            <span class="detail-inline-block">
                                <span class="detail-inline-key">Token</span>
                                <span class="skeleton-line skeleton-value skeleton-inline"></span>
                            </span>
                        </div>
                    </div>
                </div>

                <div class="payment-mode-panel">
                    <div class="detail-label mb-2">Select Payment Mode</div>
                    <div class="payment-choice-group">
                        <span class="payment-choice skeleton-choice"></span>
                        <span class="payment-choice skeleton-choice"></span>
                    </div>
                </div>

                <div class="search-result-actions">
                    <span class="btn btn-primary disabled skeleton-button"></span>
                    <span class="btn btn-outline-primary disabled skeleton-button"></span>
                </div>
            </div>
        </div>`;
    }

    ui.details.innerHTML = content;
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

function renderSummaryPaymentsTable(summaryData) {
    if (!ui.summaryPaymentsTable) {
        return;
    }

    const payments = Array.isArray(summaryData && summaryData.payments) ? summaryData.payments : [];
    if ($.fn.DataTable.isDataTable('#summaryPaymentTable')) {
        $('#summaryPaymentTable').DataTable().destroy();
    }

    if (payments.length === 0) {
        ui.summaryPaymentsTable.innerHTML = '<p class="text-muted mb-0">No payment records found for the logged-in user.</p>';
        return;
    }

    let table = `<div class="report-table-shell"><div class="table-responsive report-table-scroll"><table id="summaryPaymentTable" class="table table-bordered table-striped report-student-table">
        <thead class="table-light">
            <tr>
                <th>Reg No</th>
                <th>Name</th>
                <th>Center</th>
                <th>Payment Mode</th>
                <th>Amount</th>
            </tr>
        </thead>
        <tbody>`;

    payments.forEach((payment) => {
        table += `<tr>
            <td>${payment.regRefNo || ''}</td>
            <td>${payment.name || ''}</td>
            <td>${payment.center || ''}</td>
            <td>${payment.paymentMode || ''}</td>
            <td>${payment.amount || 0}</td>
        </tr>`;
    });

    table += '</tbody></table></div></div>';
    ui.summaryPaymentsTable.innerHTML = table;

    $('#summaryPaymentTable').DataTable({
        deferRender: true,
        pageLength: 25,
        order: [[0, 'asc']],
        search: {
            return: true
        },
        language: {
            search: 'Search summary table:'
        }
    });
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
        renderSummaryPaymentsTable(cached.data);
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
            renderSummaryPaymentsTable(result.data || {});
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
            renderSummaryPaymentsTable(cached.data);
            setStatusMessage('summary', 'Could not refresh. Showing last available data.', 'small text-warning');
        } else {
            setStatusMessage('summary', '', '');
            renderSummaryPaymentsTable({ payments: [] });
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

    let table = `<div class="report-table-shell"><div class="table-responsive report-table-scroll"><table id="studentTable" class="table table-bordered table-striped report-student-table">
        <thead class="table-light">
            <tr>
                <th>#</th>
                <th>Name</th>
                <th>Reg No</th>
                <th>Role</th>
                <th>Amount</th>
                <th>Center</th>
                <th>Service</th>
                <th>Department</th>
                <th>Mobile Number</th>
                <th>Bus Required</th>
                <th>Food Prefer..</th>
                <th>Payment Status</th>
                <th>Payment Received By</th>
            </tr>
        </thead>
        <tbody>`;
    details.forEach((detail, idx) => {
        const paymentStatus = (detail.paymentStatus || '').trim();
        const paymentStatusText = paymentStatus || 'Not Paid';
        const paymentStatusClass = paymentStatus.toUpperCase() === 'PAID' ? 'report-status-paid' : 'report-status-pending';
        const paymentReceivedBy = detail.paymentReceivedBy || '-';
        const service = (detail.service || '').replace("Service", "").replace("Not Applicable", "N/A") || '';
        const department = (detail.department || '').replace("Not Applicable", "N/A") || '';
        const busRequired = normalizeBusRequired(detail.busRequired);
        table += `<tr>
            <td>${idx + 1}</td>
            <td>${detail.name || ''}</td>
            <td>${detail.regRefNo || ''}</td>
            <td>${detail.role || ''}</td>
            <td>${detail.reg_amount || ''}</td>
            <td>${detail.center || ''}</td>
            <td>${service}</td>
            <td>${department}</td>
            <td>${detail.mobileNumber || ''}</td>
            <td>${busRequired}</td>
            <td>${detail.foodPreference || ''}</td>
            <td><span class="report-status-badge ${paymentStatusClass}">${paymentStatusText}</span></td>
            <td><span class="report-user-pill">${paymentReceivedBy}</span></td>
        </tr>`;
    });
    table += '</tbody></table></div></div>';
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
    renderSearchLoadingSkeleton();

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

// store selected or persisted payment mode per row
let paymentModeMap = {};

function displayStudentDetails(details) {
    let content = '';
    if (details.length > 0) {
        details.forEach(detail => {
            // use detail.paymentStatus if available, else ""
            const paymentStatus = (detail.paymentStatus || '').trim();
            const normalizedPaymentStatus = paymentStatus.toUpperCase();
            const isPaymentReceived = normalizedPaymentStatus === 'PAID' || normalizedPaymentStatus === 'YES';
            const normalizedTokenStatus = (detail.tokenStatus || '').trim().toUpperCase();
            const isTokenIssued = normalizedTokenStatus === 'YES';
            const paymentStatusText = isPaymentReceived ? 'PAID' : (paymentStatus || 'Not Paid');
            const paymentStatusClass = isPaymentReceived ? 'status-paid' : 'status-pending';
            const paymentStatusClickAttr = isPaymentReceived ? '' : `onclick="openPaymentDisputeDialog('${detail.rowNo}')"`;
            const paymentStatusActionClass = isPaymentReceived ? '' : 'status-chip-action';
            const paymentModeValue = (detail.paymentMode || '').trim().toUpperCase();
            const busRequired = normalizeBusRequired(detail.busRequired);
            const foodPreference = detail.foodPreference || '';
            const paymentReceivedBy = detail.paymentReceivedBy || '';
            const tokenIssuedBy = detail.tokenIssuedBy || '';
            const regAmount = detail.reg_amount || '';
            const foodPreferenceClass = foodPreference.toString().toLowerCase();
            const actionLabel = isTokenIssued ? 'Check-In Completed' : (isPaymentReceived ? 'Issue Token' : 'Payment + Token');

            // initialize map
            paymentModeMap[detail.rowNo] = paymentModeValue;

            content += `<div class="card search-result-card mt-3">
                <div class="card-body">
                    <div class="search-result-top">
                        <div>
                            <div class="search-result-role">${detail.role || 'Participant'}</div>
                            <h5 class="search-result-name mb-2">${detail.name}</h5>
                            <div class="search-result-pills">
                                <span class="result-pill">${detail.regRefNo}</span>
                                <span class="result-pill">${detail.center || 'Center NA'}</span>
                                <span class="result-pill">${detail.department || 'Department NA'}</span>
                                <span class="result-pill food-preference-pill ${foodPreferenceClass}">${foodPreference || 'Food NA'}</span>
                            </div>
                        </div>
                        <div class="search-result-status">
                            <span class="status-chip ${paymentStatusClass} ${paymentStatusActionClass}" id="paid${detail.rowNo}" ${paymentStatusClickAttr}>${paymentStatusText}</span>
                            <span class="status-caption">Payment status</span>
                        </div>
                    </div>

                    <div class="search-result-grid">
                        <div class="detail-item">
                            <span class="detail-label">Mobile</span>
                            <span class="detail-value">${detail.mobileNumber || '-'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Bus Required</span>
                            <span class="detail-value">${busRequired || '-'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Reg Amount</span>
                            <span class="detail-value">${regAmount || '-'}</span>
                        </div>
                        <div class="detail-item detail-item-wide">

                            <div class="detail-inline-pair">
                                <span class="detail-inline-block">
                                    <span class="detail-inline-key">Payment By</span>
                                    <span class="detail-value" id="payment_received_by${detail.rowNo}">${paymentReceivedBy || '-'}</span>
                                </span>
                                <span class="detail-inline-block">
                                    <span class="detail-inline-key">Token By</span>
                                    <span class="detail-value" id="token_issued${detail.rowNo}">${tokenIssuedBy || '-'}</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="payment-mode-panel">
                        <div class="detail-label mb-2">Select Payment Mode</div>
                        <div class="payment-choice-group">
                            <input type="radio"
                                            class="payment-choice-input"
                                            id="paymentMode${detail.rowNo}UPI"
                                            name="paymentMode${detail.rowNo}"
                                            onchange="updatePaymentMode('${detail.rowNo}', this.value)"
                                            value="UPI"
                                                ${paymentModeValue !== "" ? "disabled" : ""}
                                                ${paymentModeValue === "UPI" ? "checked" : ""}>
                            <label class="payment-choice" for="paymentMode${detail.rowNo}UPI">UPI</label>

                            <input type="radio"
                                            class="payment-choice-input"
                                            id="paymentMode${detail.rowNo}CASH"
                                            name="paymentMode${detail.rowNo}"
                                            onchange="updatePaymentMode('${detail.rowNo}', this.value)"
                                            value="CASH"
                                                ${paymentModeValue !== "" ? "disabled" : ""}
                                                ${paymentModeValue === "CASH" ? "checked" : ""}>
                            <label class="payment-choice" for="paymentMode${detail.rowNo}CASH">Cash</label>
                        </div>
                    </div>

                    <div class="search-result-actions">
                        <button class="btn btn-primary"
                                        id="checkInBtn${detail.rowNo}"
                                        onclick="checkIn('${detail.rowNo}', 'complete_checkin')"
                                        ${isTokenIssued ? "disabled" : ""}>${actionLabel}</button>
                    </div>
                </div>
            </div>`;
        });
    } else {
        content = '<p class="text-danger mt-3">Record not found</p>';
    }
    document.getElementById('details').innerHTML = content;
    document.querySelector('.search-result-actions .btn')?.scrollIntoView({ behavior: 'smooth' });
}

// global function
function updatePaymentMode(regRefNo, value) {
    const normalized = value.toUpperCase() === "UPI" ? "UPI" : "CASH";
    paymentModeMap[regRefNo] = normalized;

    console.log(`Payment mode for ${regRefNo} updated to: ${normalized}`);
}

// checkIn with validation
function checkIn(regRefNo, status) {
    const paymentMode = paymentModeMap[regRefNo] || "";
    const actionKey = `${regRefNo}:${status}`;
    if (inFlight.checkIn.has(actionKey)) {
        return;
    }

    const clickedButton = (window.event && window.event.currentTarget) ? window.event.currentTarget : null;
    const card = clickedButton ? clickedButton.closest('.card-body') : null;
    const paymentStatusTarget = document.getElementById(`paid${regRefNo}`);
    const paymentReceivedByTarget = document.getElementById(`payment_received_by${regRefNo}`);
    const tokenIssuedByTarget = document.getElementById(`token_issued${regRefNo}`);
    let keepActionDisabled = false;


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
        'complete_checkin': 'Check-In',
    };
    const authToken = (ui.accessTokenField && ui.accessTokenField.value) || '';

    fetchJsonWithTimeout(`${API_URL}?action=checkInStudent&regRefNo=${regRefNo}&status=${status}&paymentMode=${paymentMode}&authToken=${authToken}`, {
        timeoutMs: WRITE_TIMEOUT_MS,
        retries: 0
    })
        .then(result => {
            const statusValue = (result.status || '').toLowerCase();

            if (statusValue === 'success') {
                const responseData = result.data || {};
                if (paymentStatusTarget) {
                    paymentStatusTarget.innerText = responseData.paymentStatus || 'PAID';
                    paymentStatusTarget.classList.remove('status-pending');
                    paymentStatusTarget.classList.add('status-paid');
                }
                if (paymentReceivedByTarget) {
                    paymentReceivedByTarget.innerText = responseData.paymentReceivedBy || paymentReceivedByTarget.innerText || '-';
                }
                if (tokenIssuedByTarget) {
                    tokenIssuedByTarget.innerText = responseData.tokenIssuedBy || tokenIssuedByTarget.innerText || '-';
                }
                if (responseData.paymentMode) {
                    paymentModeMap[regRefNo] = String(responseData.paymentMode).toUpperCase();
                }
                if (clickedButton) {
                    clickedButton.innerText = 'Check-In Completed';
                }
                keepActionDisabled = true;
                showModalMessage(`${statusTextMap[status]} successful!`, true);
                requestCache.search.clear();
                requestCache.report = { data: null, updatedAt: 0 };
                requestCache.summary = { data: null, updatedAt: 0 };
                if (card) {
                    const selectedModeInput = card.querySelector(`input[name="paymentMode${regRefNo}"]:checked`);
                    if (selectedModeInput) {
                        selectedModeInput.disabled = true;
                    }
                    const unselectedModeInputs = card.querySelectorAll(`input[name="paymentMode${regRefNo}"]:not(:checked)`);
                    unselectedModeInputs.forEach((input) => {
                        input.disabled = true;
                    });
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
            if (clickedButton && !keepActionDisabled) {
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

    if (ui.disputePaidModeUpi) {
        ui.disputePaidModeUpi.addEventListener('change', toggleUpiScreenshotProofVisibility);
    }
    if (ui.disputePaidModeCash) {
        ui.disputePaidModeCash.addEventListener('change', toggleUpiScreenshotProofVisibility);
    }

    login();
});