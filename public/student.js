document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    if (!token) return window.location.href = "index.html";

    // Corrected fetch call with /api prefix
    const marksRes = await fetch("/api/student/view-marks", {
        headers: { Authorization: `Bearer ${token}` }
    });
    const marksData = await marksRes.json();
    document.getElementById("marksList").innerHTML = marksData.marks.map(m => `<li>${m}</li>`).join("");

    // Corrected fetch call with /api prefix
    const attendanceRes = await fetch("/api/student/view-attendance", {
        headers: { Authorization: `Bearer ${token}` }
    });
    const attendanceData = await attendanceRes.json();
    document.getElementById("attendance").textContent = `Attendance: ${attendanceData.attendance}%`;

    document.getElementById("uploadResearch").addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("title").value;
        const link = document.getElementById("link").value;

        // Corrected fetch call with /api prefix
        const res = await fetch("/api/student/upload-research", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ title, link })
        });
        const result = await res.json();
        document.getElementById("uploadMessage").textContent = result.message;
    });

    document.getElementById("logout").addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "index.html";
    });
});
