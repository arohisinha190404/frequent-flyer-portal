"use strict";

const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "skymiles_portal_v1";
let members = [];
let bookings = [];
let activities = [];
let selectedMemberId = null;
let searchVersion = 0;

function makeId(prefix) {
    return prefix + "-" + Date.now().toString(36).toUpperCase()
        + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

// Escape potentially dangerous HTML characters before storage.
function sanitize(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

// Render user-controlled content with textContent or DOM text nodes.
// Do not place untrusted data into innerHTML.
function addText(parent, tag, value, className = "") {
    const element = document.createElement(tag);
    element.textContent = String(value ?? "");
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
}

function analytics(action) {
    console.info(
        "[Analytics] User interacted with End-to-End Frequent Flyer Portal",
        { action }
    );
}

function notify(message, isError = false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("error-toast", isError);
    toast.classList.add("show");

    // A new notification replaces the old notification.
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => {
        toast.classList.remove("show");
    }, 3500);
}

function setMessage(id, message, isError = false) {
    const element = $(id);
    element.textContent = message;
    element.style.color = isError ? "var(--danger)" : "var(--success)";
}

function readStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const data = JSON.parse(raw);
        if (
            !data ||
            !Array.isArray(data.members) ||
            !Array.isArray(data.bookings) ||
            !Array.isArray(data.activities)
        ) {
            throw new Error("Invalid saved data");
        }

        return data;
    } catch (error) {
        console.error("Could not load saved portal data:", error);
        notify("Saved data could not be read. Starting with demo data.", true);
        return null;
    }
}

function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            members, bookings, activities
        }));
        return true;
    } catch (error) {
        console.error("Could not save portal data:", error);
        notify("Browser storage failed. Changes may not persist.", true);
        return false;
    }
}

function initializeData() {
    const saved = readStorage();

    if (saved) {
        members = saved.members;
        bookings = saved.bookings;
        activities = saved.activities;
        return;
    }

    members = [
        {
            id: "FF123456",
            name: "Aarav Sharma",
            email: "aarav@example.com",
            phone: "9876543210",
            miles: 25680
        },
        {
            id: "FF123457",
            name: "Priya Patel",
            email: "priya@example.com",
            phone: "9876543211",
            miles: 18200
        },
        {
            id: "FF123458",
            name: "Rohan Mehta",
            email: "rohan@example.com",
            phone: "9876543212",
            miles: 9500
        }
    ];

    bookings = [
        {
            id: makeId("BK"), memberId: "FF123456",
            flight: "AI101", from: "DEL", to: "BOM",
            date: "2026-10-12", status: "Confirmed"
        },
        {
            id: makeId("BK"), memberId: "FF123457",
            flight: "6E203", from: "BLR", to: "DEL",
            date: "2026-10-14", status: "Confirmed"
        },
        {
            id: makeId("BK"), memberId: "FF123458",
            flight: "UK742", from: "BOM", to: "LHR",
            date: "2026-10-16", status: "Pending"
        }
    ];

    activities = [];
    saveData();
}

function addActivity(message) {
    activities.unshift({
        id: makeId("AC"),
        message: sanitize(message),
        time: new Date().toLocaleString()
    });

    activities = activities.slice(0, 20);
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString("en-IN");
}

function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value + "T00:00:00");
    return Number.isNaN(date.getTime())
        ? "Invalid date"
        : date.toLocaleDateString("en-IN", {
            day: "2-digit", month: "short", year: "numeric"
        });
}

function getMember(id) {
    return members.find((member) => member.id === id);
}

function renderStats() {
    $("total-members").textContent = formatNumber(members.length);
    $("total-flights").textContent = formatNumber(bookings.length);

    const totalMiles = members.reduce(
        (total, member) => total + Number(member.miles || 0), 0
    );

    $("total-miles").textContent = formatNumber(totalMiles);
    $("active-rewards").textContent = formatNumber(
        members.filter((member) => member.miles > 0).length
    );
}

function renderBookings(showAll = false) {
    const body = $("booking-list");
    body.replaceChildren();

    const list = showAll ? bookings : bookings.slice(0, 5);
    $("booking-empty").hidden = list.length !== 0;

    list.forEach((booking) => {
        const member = getMember(booking.memberId);
        const row = document.createElement("tr");

        addText(row, "td", member ? member.name : "Unknown member");
        addText(row, "td", booking.flight);
        addText(row, "td", `${booking.from} → ${booking.to}`);
        addText(row, "td", formatDate(booking.date));

        const statusCell = document.createElement("td");
        const status = addText(
            statusCell, "span", booking.status,
            "status " + booking.status.toLowerCase()
        );
        status.setAttribute("aria-label", "Booking status: " + booking.status);
        row.appendChild(statusCell);

        body.appendChild(row);
    });

    $("view-all").textContent = showAll ? "Show Less ↑" : "View All →";
}

function renderActivities() {
    const list = $("activity-list");
    list.replaceChildren();
    $("activity-empty").hidden = activities.length > 0;

    activities.slice(0, 5).forEach((activity) => {
        const item = document.createElement("li");
        addText(item, "span", activity.message);
        item.appendChild(document.createElement("br"));
        addText(item, "small", activity.time);
        list.appendChild(item);
    });
}

function updateMemberOptions() {
    ["booking-member", "reward-member"].forEach((id) => {
        const select = $(id);
        const oldValue = select.value;
        select.replaceChildren();

        addText(select, "option", "Select a member").value = "";

        members.forEach((member) => {
            const option = document.createElement("option");
            option.value = member.id;
            option.textContent = `${member.name} (${member.id})`;
            select.appendChild(option);
        });

        if (members.some((member) => member.id === oldValue)) {
            select.value = oldValue;
        }
    });
}

function renderMemberCard(member) {
    $("card-name").textContent = member ? member.name : "Select a member";
    $("card-id").textContent = "Member ID: " + (member ? member.id : "—");
    $("card-miles").textContent = formatNumber(member ? member.miles : 0);
}

function renderMemberResult(member) {
    const container = $("member-results");
    container.replaceChildren();

    if (!member) {
        addText(container, "p", "No data found. Try another member ID, name, or email.", "empty-state");
        return;
    }

    selectedMemberId = member.id;
    renderMemberCard(member);

    const card = document.createElement("div");
    card.className = "member-result";

    addText(card, "h3", member.name);
    addText(card, "p", "Member ID: " + member.id);
    addText(card, "p", "Email: " + member.email);
    addText(card, "p", "Phone: " + member.phone);
    addText(card, "p", "Available miles: " + formatNumber(member.miles));

    container.appendChild(card);
}

function renderAll() {
    renderStats();
    renderBookings();
    renderActivities();
    updateMemberOptions();

    if (selectedMemberId) {
        const selected = getMember(selectedMemberId);
        renderMemberCard(selected || null);
    }
}

function showLoading(container, message = "Loading...") {
    container.replaceChildren();
    const line = document.createElement("p");
    line.className = "loading";

    const spinner = document.createElement("span");
    spinner.className = "spinner";
    spinner.setAttribute("aria-hidden", "true");

    line.appendChild(spinner);
    line.appendChild(document.createTextNode(message));
    container.appendChild(line);
}

// Simulate asynchronous work. A timeout is used only for the demo.
function wait(ms = 200) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function setFieldError(inputId, errorId, message) {
    const input = $(inputId);
    const error = $(errorId);

    input.classList.toggle("invalid", Boolean(message));
    input.setAttribute("aria-invalid", message ? "true" : "false");
    error.textContent = message || "";
}

function clearErrors(form) {
    form.querySelectorAll(".field-error").forEach((element) => {
        element.textContent = "";
    });

    form.querySelectorAll("input, select").forEach((input) => {
        input.classList.remove("invalid");
        input.removeAttribute("aria-invalid");
    });
}

function validateName() {
    const value = $("member-name").value.trim();
    const valid = value.length >= 2 &&
        value.length <= 80 &&
        /^[\p{L}\p{M} .'-]+$/u.test(value);

    setFieldError("member-name", "name-error",
        valid ? "" : "Enter a valid name (2–80 characters).");

    return valid;
}

function validateEmail() {
    const value = $("member-email").value.trim();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) &&
        value.length <= 120;

    setFieldError("member-email", "email-error",
        valid ? "" : "Enter a valid email address.");

    return valid;
}

function validatePhone() {
    const value = $("member-phone").value.trim();
    const valid = /^[6-9]\d{9}$/.test(value);

    setFieldError("member-phone", "phone-error",
        valid ? "" : "Enter a valid 10-digit mobile number.");

    return valid;
}

function validateMiles() {
    const input = $("initial-miles");
    const value = input.valueAsNumber;
    const valid = input.value.trim() !== "" &&
        Number.isInteger(value) && value >= 0 && value <= 1000000;

    setFieldError("initial-miles", "miles-error",
        valid ? "" : "Miles must be an integer from 0 to 1,000,000.");

    return valid;
}

function validateBooking() {
    const checks = [
        {
            input: "booking-member",
            error: "booking-member-error",
            valid: Boolean(getMember($("booking-member").value)),
            message: "Select a valid member."
        },
        {
            input: "flight-number",
            error: "flight-number-error",
            valid: /^[A-Za-z0-9]{2,10}$/.test($("flight-number").value.trim()),
            message: "Enter a valid flight number."
        },
        {
            input: "flight-from",
            error: "flight-from-error",
            valid: /^[A-Za-z]{3}$/.test($("flight-from").value.trim()),
            message: "Enter a 3-letter airport code."
        },
        {
            input: "flight-to",
            error: "flight-to-error",
            valid: /^[A-Za-z]{3}$/.test($("flight-to").value.trim()),
            message: "Enter a 3-letter airport code."
        },
        {
            input: "flight-date",
            error: "flight-date-error",
            valid: /^\d{4}-\d{2}-\d{2}$/.test($("flight-date").value) &&
                $("flight-date").value >= new Date().toISOString().slice(0, 10),
            message: "Choose today or a future date."
        }
    ];

    checks.forEach((item) => {
        setFieldError(item.input, item.error, item.valid ? "" : item.message);
    });

    if (
        $("flight-from").value.trim().toUpperCase() ===
        $("flight-to").value.trim().toUpperCase()
    ) {
        setFieldError("flight-to", "flight-to-error",
            "Departure and arrival airports must differ.");
        checks.find((item) => item.input === "flight-to").valid = false;
    }

    return checks.every((item) => item.valid);
}

function validateReward() {
    const member = getMember($("reward-member").value);
    const input = $("reward-miles");
    const miles = input.valueAsNumber;

    const valid = Boolean(member) &&
        input.value.trim() !== "" &&
        Number.isInteger(miles) &&
        miles > 0 &&
        miles <= (member ? member.miles : 0);

    setFieldError("reward-member", "reward-member-error",
        member ? "" : "Select a valid member.");

    setFieldError("reward-miles", "reward-miles-error",
        valid ? "" : `Enter whole miles greater than zero and no more than the member's balance.`);

    return valid;
}

async function searchMember(query, resultContainer, errorId) {
    const search = query.trim();

    if (!search) {
        $(errorId).textContent = "Enter a member ID, name, or email.";
        return;
    }

    $(errorId).textContent = "";
    const currentVersion = ++searchVersion;

    showLoading(resultContainer, "Searching members...");

    try {
        await wait();

        // Ignore an older search if the user has submitted a newer one.
        if (currentVersion !== searchVersion) return;

        const normalized = search.toLowerCase();
        const member = members.find((item) =>
            [item.id, item.name, item.email].some(
                (value) => String(value).toLowerCase() === normalized
            )
        );

        if (currentVersion !== searchVersion) return;

        renderMemberResult(member || null);
        analytics("member_search");

        if (!member) notify("No data found for that search.");
    } catch (error) {
        console.error("Member search failed:", error);
        resultContainer.replaceChildren();
        addText(resultContainer, "p",
            "Search failed. Please try again.", "empty-state");
        notify("Search failed. Please try again.", true);
    }
}

$("hero-search").addEventListener("submit", (event) => {
    event.preventDefault();

    const query = $("global-query").value;
    searchMember(query, $("member-results"), "global-error");
});

$("member-search-form").addEventListener("submit", (event) => {
    event.preventDefault();

    searchMember(
        $("member-query").value,
        $("member-results"),
        "search-error"
    );
});

// Validate fields as users correct them.
[
    ["member-name", validateName],
    ["member-email", validateEmail],
    ["member-phone", validatePhone],
    ["initial-miles", validateMiles]
].forEach(([id, validator]) => {
    $(id).addEventListener("input", validator);
});

$("enroll-form").addEventListener("submit", async (event) => {
    const form = event.currentTarget;
    event.preventDefault();
    clearErrors(event.currentTarget);
    setMessage("enroll-message", "");

    if (![validateName(), validateEmail(), validatePhone(), validateMiles()]
        .every(Boolean)) {
        event.currentTarget.querySelector(".invalid")?.focus();
        return;
    }

    const name = sanitize($("member-name").value.trim());
    const email = sanitize($("member-email").value.trim().toLowerCase());
    const phone = $("member-phone").value.trim();
    const miles = $("initial-miles").valueAsNumber;

    if (members.some((member) => member.email.toLowerCase() === email.toLowerCase())) {
        setFieldError("member-email", "email-error",
            "This email is already registered.");
        $("member-email").focus();
        return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Enrolling...";

    try {
        await wait();

        const member = {
            id: makeId("FF"),
            name, email, phone, miles
        };

        members.push(member);
        selectedMemberId = member.id;
        addActivity(`New member enrolled: ${member.name}`);
        saveData();
        renderAll();
        renderMemberResult(member);

        $("enroll-form").reset();
        $("initial-miles").value = "0";
        setMessage("enroll-message", `Member enrolled successfully. ID: ${member.id}`);
        notify("Member enrolled successfully.");
        analytics("member_enrolled");
    } catch (error) {
        console.error("Enrollment failed:", error);
        setMessage("enroll-message", "Enrollment failed. Please try again.", true);
    } finally {
        button.disabled = false;
        button.textContent = "Enroll Member";
    }
});

$("booking-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(event.currentTarget);
    setMessage("booking-message", "");

    if (!validateBooking()) {
        event.currentTarget.querySelector(".invalid")?.focus();
        return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Processing...";

    try {
        await wait();

        const booking = {
            id: makeId("BK"),
            memberId: $("booking-member").value,
            flight: sanitize($("flight-number").value.trim().toUpperCase()),
            from: $("flight-from").value.trim().toUpperCase(),
            to: $("flight-to").value.trim().toUpperCase(),
            date: $("flight-date").value,
            status: "Confirmed"
        };

        bookings.unshift(booking);
        addActivity(`Flight booked: ${booking.flight}`);
        saveData();
        renderAll();

    form.reset();
        setMessage("booking-message", "Flight booking confirmed.");
        notify("Flight booked successfully.");
        analytics("flight_booked");
    } catch (error) {
    console.error("Enrollment failed:", error);

    setMessage(
        "enroll-message",
        `Enrollment failed: ${error.message}`,
        true
    );

    notify("Enrollment failed. Check the console.", true);
} finally {
    button.disabled = false;
    button.textContent = "Enroll Member";
}
});

$("reward-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(event.currentTarget);
    setMessage("reward-message", "");

    if (!validateReward()) {
        event.currentTarget.querySelector(".invalid")?.focus();
        return;
    }

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = "Processing...";

    try {
        await wait();

        const member = getMember($("reward-member").value);
        const miles = $("reward-miles").valueAsNumber;

        // Recheck balance immediately before redemption.
        if (!member || !Number.isInteger(miles) ||
            miles <= 0 || miles > member.miles) {
            setMessage("reward-message",
                "Insufficient miles or invalid member.", true);
            return;
        }

        member.miles -= miles;
        selectedMemberId = member.id;

        addActivity(`${formatNumber(miles)} miles redeemed by ${member.name}`);
        saveData();
        renderAll();
        renderMemberResult(member);

        event.currentTarget.reset();
        setMessage("reward-message", "Miles redeemed successfully.");
        notify("Miles redeemed successfully.");
        analytics("miles_redeemed");
    } catch (error) {
        console.error("Miles redemption failed:", error);
        setMessage("reward-message", "Redemption failed. Please try again.", true);
    } finally {
        button.disabled = false;
        button.textContent = "Redeem Miles";
    }
});

$("view-all").addEventListener("click", () => {
    const expanded = $("view-all").textContent.includes("View All");
    renderBookings(expanded);
    analytics("view_bookings");
});

// Clear validation styling as users begin correcting invalid fields.
document.querySelectorAll("input, select").forEach((input) => {
    input.addEventListener("input", () => {
        if (input.classList.contains("invalid")) {
            input.classList.remove("invalid");
            input.setAttribute("aria-invalid", "false");
        }
    });
});

initializeData();
renderAll();

console.info("SkyMiles portal initialized.");