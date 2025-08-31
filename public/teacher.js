document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    if (!token) return window.location.href = "index.html";

    const messageBox = document.getElementById("messageBox");
    const showMessage = (message, isError = false) => {
        messageBox.textContent = message;
        messageBox.className = isError ? "text-red-500" : "text-green-500";
        messageBox.style.display = "block";
    };

    // Fetch and display student list
    const studentsRes = await fetch("/api/teachers/students", {
        headers: { Authorization: `Bearer ${token}` }
    });
    if (studentsRes.ok) {
        const studentsData = await studentsRes.json();
        const studentList = document.getElementById("studentList");
        studentList.innerHTML = studentsData.students.map(student => `
            <li>
                <span>${student.name} (${student.regNo})</span>
                <button onclick="viewStudentDetails('${student.regNo}')" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-2 rounded ml-2">View Details</button>
            </li>
        `).join("");
    } else {
        showMessage("Failed to fetch student list.", true);
    }

    // Handle student detail updates
    document.getElementById("updateDetailsForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const regNo = document.getElementById("studentRegNo").value;
        const studentName = document.getElementById("studentName").value;
        const studentEmail = document.getElementById("studentEmail").value;
        const studentDept = document.getElementById("studentDept").value;
        const researchPapers = document.getElementById("studentPapers").value.split(',').map(p => p.trim());

        const res = await fetch("/api/teacher/addStudentDetails", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ regNo, name: studentName, email: studentEmail, department: studentDept, researchPapers })
        });
        const result = await res.json();
        showMessage(result.message, !result.success);
    });

    // Handle research paper status updates
    document.getElementById("updatePaperStatusForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const regNo = document.getElementById("paperStudentRegNo").value;
        const filename = document.getElementById("paperFilename").value;
        const status = document.getElementById("paperStatus").value;
        const comment = document.getElementById("paperComment").value;

        const res = await fetch("/api/teacher/updateResearchPaperStatus", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ regNo, filename, status, teacherComment: comment })
        });
        const result = await res.json();
        showMessage(result.message, !result.success);
    });

    // Handle profile update
    document.getElementById("updateProfileForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const res = await fetch("/api/teacher/updateProfile", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData
        });
        const result = await res.json();
        showMessage(result.message, !result.success);
    });

    document.getElementById("logout").addEventListener("click", () => {
        localStorage.removeItem("token");
        window.location.href = "index.html";
    });
});

async function viewStudentDetails(regNo) {
    const token = localStorage.getItem("token");
    if (!token) return window.location.href = "index.html";

    const res = await fetch(`/api/teacher/student/${regNo}`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const student = await res.json();
    if (student.success) {
        // You would typically render these details on the page
        console.log("Student Details:", student.student);
        // Example of rendering:
        // document.getElementById("studentDetailsDisplay").innerHTML = `Name: ${student.student.name}`;
        const studentDetailView = document.getElementById("studentDetailView");
        studentDetailView.innerHTML = `
            <h3 class="text-xl font-bold mb-2">Details for ${student.student.name}</h3>
            <p>Registration No: ${student.student.regNo}</p>
            <p>Email: ${student.student.email}</p>
            <p>Department: ${student.student.department}</p>
            <h4 class="font-bold mt-4">Research Papers</h4>
            <ul>
                ${student.student.researchPapers.map(p => `<li>${p.filename} - Status: ${p.status}</li>`).join("")}
            </ul>
        `;
    }
}
