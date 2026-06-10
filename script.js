const video = document.getElementById('video');
const statusMsg = document.getElementById('status-message');
const attendanceRows = document.getElementById('attendance-rows');

let markedStudents = new Set();

const allStudents = [
    { id: "ST001", name: "Sandaru" },
    { id: "ST002", name: "Nirmal" }


];

let attendanceData = [];

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('https://raw.githubusercontent.com/vladmandic/face-api/master/model'),
    faceapi.nets.faceLandmark68Net.loadFromUri('https://raw.githubusercontent.com/vladmandic/face-api/master/model'),
    faceapi.nets.faceRecognitionNet.loadFromUri('https://raw.githubusercontent.com/vladmandic/face-api/master/model'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('https://raw.githubusercontent.com/vladmandic/face-api/master/model')
]).then(startVideo);

function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: {} })
        .then(stream => {
            video.srcObject = stream;
            statusMsg.innerText = "System Ready";
            statusMsg.style.background = "gray";
        })
        .catch(err => {
            console.error(err);
            statusMsg.innerText = "Camera Access Denied";
            statusMsg.style.background = "red";
        });
}

video.addEventListener('play', async () => {

    const canvas = faceapi.createCanvasFromMedia(video);
    video.parentElement.append(canvas);

    const displaySize = {
        width: video.clientWidth,
        height: video.clientHeight
    };

    faceapi.matchDimensions(canvas, displaySize);

    const labeledFaceDescriptors = await loadLabeledImages();
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.5);

    statusMsg.innerText = "Scanning Active";
    statusMsg.style.background = "blue";

    setInterval(async () => {

        const detections = await faceapi
            .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
            .withFaceLandmarks()
            .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);

        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        faceapi.draw.drawDetections(canvas, resizedDetections);

        if (detections.length === 0) {
            statusMsg.innerText = "No Face Detected";
            statusMsg.style.background = "orange";
            return;
        }

        if (detections.length > 1) {
            statusMsg.innerText = "Multiple Faces Not Allowed";
            statusMsg.style.background = "red";
            return;
        }

        const detection = resizedDetections[0];
        const result = faceMatcher.findBestMatch(detection.descriptor);

        const folderName = result.label;
        const confidence = result.distance;

        // ✅ STRICT MATCH CONDITION
        if (folderName === "unknown" || confidence > 0.45) {
            statusMsg.innerText = "Face Not Recognized";
            statusMsg.style.background = "red";
            return;
        }

        if (!markedStudents.has(folderName)) {
            markAttendance(folderName);
        } else {
            statusMsg.innerText = "Attendance Already Marked";
            statusMsg.style.background = "blue";
        }

    }, 1000);
});

async function loadLabeledImages() {

    const labels = [
        'ST001_Sandaru',
        'ST002_Nirmal'
    ];

    return Promise.all(labels.map(async label => {

        const descriptions = [];

        try {

            // Use multiple images per student for accuracy
            for (let i = 1; i <= 3; i++) {

                const imgPath = `labeled_images/${label}/${i}.jpeg`;

                const img = await faceapi.fetchImage(imgPath);

                const detection = await faceapi
                    .detectSingleFace(img)
                    .withFaceLandmarks()
                    .withFaceDescriptor();

                if (detection) {
                    descriptions.push(detection.descriptor);
                }
            }

        } catch (e) {
            console.error("Error loading images for:", label, e);
        }

        return new faceapi.LabeledFaceDescriptors(label, descriptions);
    }));
}

function markAttendance(folderName) {

    if (markedStudents.has(folderName)) return;

    markedStudents.add(folderName);

    const [studentID, studentName] = folderName.split('_');

    const now = new Date();
    const timeString = now.toLocaleTimeString();

    attendanceData.push({
        id: studentID,
        name: studentName,
        status: "Present",
        time: timeString
    });

    const row = document.createElement('tr');
    row.innerHTML = `
        <td>${studentID}</td>
        <td>${studentName}</td>
        <td style="color:green;">Present</td>
        <td>${timeString}</td>
    `;

    attendanceRows.insertBefore(row, attendanceRows.firstChild);

    statusMsg.innerText = `${studentName} Marked Present`;
    statusMsg.style.background = "green";
}

function showAbsentStudents() {

    allStudents.forEach(student => {

        const fullName = `${student.id}_${student.name}`;

        if (!markedStudents.has(fullName)) {

            const row = document.createElement('tr');

            row.innerHTML = `
                <td>${student.id}</td>
                <td>${student.name}</td>
                <td style="color:red;">Absent</td>
                <td>--</td>
            `;

            attendanceRows.appendChild(row);

            attendanceData.push({
                id: student.id,
                name: student.name,
                status: "Absent",
                time: "--"
            });
        }
    });

    generateInsights();
    exportCSV();
}

function generateInsights() {

    let presentCount = attendanceData.filter(s => s.status === "Present").length;
    let absentCount = attendanceData.filter(s => s.status === "Absent").length;

    console.log("Total Students:", allStudents.length);
    console.log("Present:", presentCount);
    console.log("Absent:", absentCount);
    console.log(attendanceData);
}

function exportCSV() {

    let csvContent = "Student ID,Name,Status,Time\n";

    attendanceData.forEach(s => {
        csvContent += `${s.id},${s.name},${s.status},${s.time}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'attendance_report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

setTimeout(() => {
    showAbsentStudents();
}, 30000);      
